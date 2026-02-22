"""
PS Consult – UNTH: Authentication Router
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from pydantic import BaseModel as PydanticBaseModel

from database import get_db
from models import User, UserRole, AuditAction
from schemas import LoginRequest, Token, UserCreate, UserOut, UserUpdate
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_roles, log_audit
)
from config import settings

# Doctor access code – change in production via DOCTOR_CODE env var
import os
DOCTOR_CODE = os.getenv("DOCTOR_CODE", "BLACKVELVET")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    log_audit(
        db, AuditAction.LOGIN, user_id=user.id,
        details=f"User {user.username} logged in",
        ip_address=request.client.host if request.client else None,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


class CodeLoginRequest(PydanticBaseModel):
    code: str


@router.post("/code-login", response_model=Token)
async def code_login(request: Request, body: CodeLoginRequest, db: Session = Depends(get_db)):
    """Login using the doctor access code. Returns admin-level token."""
    if body.code.strip().upper() != DOCTOR_CODE.upper():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access code",
        )

    # Find the admin user (or first consultant)
    admin_user = db.query(User).filter(
        User.role == UserRole.ADMIN, User.is_active == True
    ).first()
    if not admin_user:
        admin_user = db.query(User).filter(
            User.role == UserRole.CONSULTANT, User.is_active == True
        ).first()
    if not admin_user:
        raise HTTPException(status_code=500, detail="No admin user found in system")

    access_token = create_access_token(
        data={"sub": admin_user.username, "role": admin_user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    log_audit(
        db, AuditAction.LOGIN, user_id=admin_user.id,
        details=f"Doctor code login (admin access)",
        ip_address=request.client.host if request.client else None,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(admin_user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/register", response_model=UserOut)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Only admins can register new users."""
    existing = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    new_user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        unit=user_data.unit,
        phone_number=user_data.phone_number,
        email=user_data.email,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(
        db, AuditAction.CREATED, user_id=current_user.id,
        details=f"Created user {new_user.username} with role {new_user.role.value}",
    )

    return UserOut.model_validate(new_user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    users = db.query(User).all()
    return [UserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in user_data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)

    log_audit(
        db, AuditAction.MODIFIED, user_id=current_user.id,
        details=f"Updated user {user.username}",
    )

    return UserOut.model_validate(user)
