"""
PS Consult – UNTH: Review Documentation Router

Handles clinical review documentation by the Plastic Surgery team.
"""

import base64
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session

from database import get_db
from models import (
    ConsultReview, ConsultRequest, Photo, User, UserRole,
    ConsultStatus, AuditAction
)
from schemas import ConsultReviewCreate, ConsultReviewOut
from auth import get_current_user, require_roles, log_audit
from config import settings

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post("/{consult_id}", response_model=ConsultReviewOut, status_code=201)
async def create_review(
    consult_id: int,
    review_data: ConsultReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT
    )),
):
    """Create a clinical review for a consult."""
    consult = db.query(ConsultRequest).filter(ConsultRequest.id == consult_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    review = ConsultReview(
        consult_id=consult_id,
        reviewed_by=current_user.id,
        **review_data.model_dump(),
    )
    db.add(review)

    # Update consult status
    consult.status = ConsultStatus.REVIEWED
    consult.reviewed_at = datetime.utcnow()

    if review_data.procedure_scheduled:
        consult.status = ConsultStatus.PROCEDURE_PLANNED

    log_audit(
        db, AuditAction.REVIEWED, user_id=current_user.id,
        consult_id=consult_id,
        details=f"Review created by {current_user.full_name}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(review)
    return ConsultReviewOut.model_validate(review)


@router.get("/{consult_id}", response_model=list[ConsultReviewOut])
async def get_reviews(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all reviews for a consult."""
    reviews = (
        db.query(ConsultReview)
        .filter(ConsultReview.consult_id == consult_id)
        .order_by(ConsultReview.created_at.desc())
        .all()
    )
    return [ConsultReviewOut.model_validate(r) for r in reviews]


@router.put("/{review_id}", response_model=ConsultReviewOut)
async def update_review(
    review_id: int,
    review_data: ConsultReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT
    )),
):
    """Update an existing review."""
    review = db.query(ConsultReview).filter(ConsultReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    for field, value in review_data.model_dump(exclude_unset=True).items():
        setattr(review, field, value)

    log_audit(
        db, AuditAction.MODIFIED, user_id=current_user.id,
        consult_id=review.consult_id,
        details=f"Review {review_id} updated by {current_user.full_name}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(review)
    return ConsultReviewOut.model_validate(review)


@router.post("/{consult_id}/photos")
async def upload_photo(
    consult_id: int,
    file: UploadFile = File(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT
    )),
):
    """Upload a wound photo for a consult."""
    consult = db.query(ConsultRequest).filter(ConsultRequest.id == consult_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    # Validate file size
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Encode as base64 and store in database (serverless-friendly)
    b64_data = base64.b64encode(contents).decode("utf-8")
    filename = file.filename or "photo.jpg"

    photo = Photo(
        consult_id=consult_id,
        filename=filename,
        content_type=file.content_type,
        data=b64_data,
        description=description,
        uploaded_by=current_user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return {
        "id": photo.id,
        "filename": photo.filename,
        "description": photo.description,
        "uploaded_at": photo.uploaded_at.isoformat(),
    }


@router.get("/{consult_id}/photos")
async def list_photos(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all photos for a consult."""
    photos = db.query(Photo).filter(Photo.consult_id == consult_id).all()
    return [
        {
            "id": p.id,
            "filename": p.filename,
            "description": p.description,
            "url": f"data:{p.content_type};base64,{p.data}",
            "uploaded_at": p.uploaded_at.isoformat(),
        }
        for p in photos
    ]
