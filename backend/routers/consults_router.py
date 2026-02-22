"""
PS Consult – UNTH: Consult Requests Router

Handles CRUD operations for consult requests with:
- Unique Consult ID generation (PSC-YYYY-NNNNN)
- Status tracking with timestamps
- Offline sync support (client_id)
- Acknowledgement system
- Audit logging
"""

import base64
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database import get_db
from models import (
    ConsultRequest, User, UserRole, ConsultStatus, UrgencyLevel,
    AuditAction, Notification, SyncStatus, Photo
)
from config import settings
from schemas import (
    ConsultRequestCreate, ConsultRequestOut, ConsultStatusUpdate,
    ConsultListResponse, ConsultAcknowledgement
)
from auth import get_current_user, require_roles, log_audit

router = APIRouter(prefix="/api/consults", tags=["Consult Requests"])


def generate_consult_id(db: Session) -> str:
    """Generate unique consult ID: PSC-YYYY-NNNNN"""
    year = datetime.utcnow().year
    year_start = datetime(year, 1, 1)
    year_end = datetime(year + 1, 1, 1)
    last = (
        db.query(ConsultRequest)
        .filter(ConsultRequest.created_at >= year_start)
        .filter(ConsultRequest.created_at < year_end)
        .order_by(ConsultRequest.id.desc())
        .first()
    )
    seq = 1
    if last and last.consult_id:
        try:
            seq = int(last.consult_id.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    return f"PSC-{year}-{seq:05d}"


def create_notification(db: Session, user_id: int, consult_id: int, title: str, message: str):
    """Create an in-app notification."""
    notif = Notification(
        user_id=user_id,
        consult_id=consult_id,
        title=title,
        message=message,
    )
    db.add(notif)


def notify_plastic_surgery_team(db: Session, consult: ConsultRequest):
    """Notify all plastic surgery team members about a new consult."""
    ps_users = db.query(User).filter(
        User.role.in_([UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT]),
        User.is_active == True,
    ).all()

    for user in ps_users:
        create_notification(
            db, user.id, consult.id,
            title=f"New Consult – {consult.urgency.value.upper()}",
            message=(
                f"New consult from {consult.inviting_unit}: "
                f"{consult.patient_name} ({consult.ward}). "
                f"Urgency: {consult.urgency.value}. "
                f"Contact: {consult.phone_number}"
            ),
        )
    consult.notification_sent = True


@router.post("/", response_model=ConsultAcknowledgement, status_code=status.HTTP_201_CREATED)
async def create_consult(
    request: Request,
    consult_data: ConsultRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new consult request with immediate acknowledgement."""
    # Check for duplicate offline submission
    if consult_data.client_id:
        existing = db.query(ConsultRequest).filter(
            ConsultRequest.client_id == consult_data.client_id
        ).first()
        if existing:
            return ConsultAcknowledgement(
                status="success",
                consult_id=existing.consult_id,
                received_at=existing.created_at,
                message="Consult request already received (duplicate detected).",
            )

    consult_id = generate_consult_id(db)

    consult = ConsultRequest(
        consult_id=consult_id,
        patient_name=consult_data.patient_name,
        hospital_number=consult_data.hospital_number,
        age=consult_data.age,
        sex=consult_data.sex,
        ward=consult_data.ward,
        bed_number=consult_data.bed_number,
        date_of_admission=consult_data.date_of_admission,
        primary_diagnosis=consult_data.primary_diagnosis,
        indication=consult_data.indication,
        indication_category=consult_data.indication_category,
        urgency=consult_data.urgency,
        inviting_unit=consult_data.inviting_unit,
        consultant_in_charge=consult_data.consultant_in_charge,
        requesting_doctor=consult_data.requesting_doctor,
        designation=consult_data.designation,
        phone_number=consult_data.phone_number,
        alternate_phone=consult_data.alternate_phone,
        status=ConsultStatus.PENDING,
        sync_status=SyncStatus.SYNCED,
        created_by=current_user.id,
        client_id=consult_data.client_id,
    )
    db.add(consult)
    db.flush()

    # Notify plastic surgery team
    notify_plastic_surgery_team(db, consult)

    # Audit log
    log_audit(
        db, AuditAction.CREATED, user_id=current_user.id,
        consult_id=consult.id,
        details=f"Consult {consult_id} created for patient {consult.patient_name}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(consult)

    return ConsultAcknowledgement(
        status="success",
        consult_id=consult.consult_id,
        received_at=consult.created_at,
        message="Consult request received and Plastic Surgery Unit notified.",
    )


@router.post("/public", response_model=ConsultAcknowledgement, status_code=status.HTTP_201_CREATED)
async def create_consult_public(
    request: Request,
    consult_data: ConsultRequestCreate,
    db: Session = Depends(get_db),
):
    """Create a consult request WITHOUT authentication (open access)."""
    # Check for duplicate offline submission
    if consult_data.client_id:
        existing = db.query(ConsultRequest).filter(
            ConsultRequest.client_id == consult_data.client_id
        ).first()
        if existing:
            return ConsultAcknowledgement(
                status="success",
                consult_id=existing.consult_id,
                received_at=existing.created_at,
                message="Consult request already received (duplicate detected).",
            )

    consult_id = generate_consult_id(db)

    consult = ConsultRequest(
        consult_id=consult_id,
        patient_name=consult_data.patient_name,
        hospital_number=consult_data.hospital_number,
        age=consult_data.age,
        sex=consult_data.sex,
        ward=consult_data.ward,
        bed_number=consult_data.bed_number,
        date_of_admission=consult_data.date_of_admission,
        primary_diagnosis=consult_data.primary_diagnosis,
        indication=consult_data.indication,
        indication_category=consult_data.indication_category,
        urgency=consult_data.urgency,
        inviting_unit=consult_data.inviting_unit,
        consultant_in_charge=consult_data.consultant_in_charge,
        requesting_doctor=consult_data.requesting_doctor,
        designation=consult_data.designation,
        phone_number=consult_data.phone_number,
        alternate_phone=consult_data.alternate_phone,
        status=ConsultStatus.PENDING,
        sync_status=SyncStatus.SYNCED,
        created_by=None,
        client_id=consult_data.client_id,
    )
    db.add(consult)
    db.flush()

    # Notify plastic surgery team
    notify_plastic_surgery_team(db, consult)

    # Audit log (no user)
    log_audit(
        db, AuditAction.CREATED, user_id=None,
        consult_id=consult.id,
        details=f"Public consult {consult_id} created for patient {consult.patient_name} by {consult_data.requesting_doctor}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(consult)

    return ConsultAcknowledgement(
        status="success",
        consult_id=consult.consult_id,
        received_at=consult.created_at,
        message="Consult request received and Plastic Surgery Unit notified.",
    )


@router.get("/", response_model=ConsultListResponse)
async def list_consults(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    ward: Optional[str] = None,
    urgency: Optional[UrgencyLevel] = None,
    status_filter: Optional[ConsultStatus] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List consults with filtering and pagination."""
    query = db.query(ConsultRequest).options(joinedload(ConsultRequest.creator))

    # Role-based filtering: inviting units only see their own consults
    if current_user.role == UserRole.INVITING_UNIT:
        query = query.filter(ConsultRequest.created_by == current_user.id)

    # Filters
    if ward:
        query = query.filter(ConsultRequest.ward.ilike(f"%{ward}%"))
    if urgency:
        query = query.filter(ConsultRequest.urgency == urgency)
    if status_filter:
        query = query.filter(ConsultRequest.status == status_filter)
    if date_from:
        query = query.filter(func.date(ConsultRequest.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(ConsultRequest.created_at) <= date_to)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ConsultRequest.patient_name.ilike(search_term)) |
            (ConsultRequest.hospital_number.ilike(search_term)) |
            (ConsultRequest.consult_id.ilike(search_term))
        )

    total = query.count()
    consults = (
        query
        .order_by(ConsultRequest.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return ConsultListResponse(
        total=total,
        page=page,
        per_page=per_page,
        consults=[ConsultRequestOut.model_validate(c) for c in consults],
    )


@router.get("/{consult_id}", response_model=ConsultRequestOut)
async def get_consult(
    consult_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific consult by ID."""
    consult = (
        db.query(ConsultRequest)
        .options(joinedload(ConsultRequest.creator))
        .filter(ConsultRequest.id == consult_id)
        .first()
    )
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    # Inviting units can only view their own
    if current_user.role == UserRole.INVITING_UNIT and consult.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return ConsultRequestOut.model_validate(consult)


@router.patch("/{consult_id}/status", response_model=ConsultRequestOut)
async def update_consult_status(
    consult_id: int,
    status_update: ConsultStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN
    )),
):
    """Update consult status (Plastic Surgery team only)."""
    consult = db.query(ConsultRequest).filter(ConsultRequest.id == consult_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    old_status = consult.status
    consult.status = status_update.status

    # Set timestamps based on status
    now = datetime.utcnow()
    if status_update.status == ConsultStatus.ACCEPTED:
        consult.accepted_by = current_user.id
        consult.accepted_at = now
    elif status_update.status == ConsultStatus.REVIEWED:
        consult.reviewed_at = now
    elif status_update.status == ConsultStatus.COMPLETED:
        consult.completed_at = now

    # Notify the requesting unit
    create_notification(
        db, consult.created_by, consult.id,
        title=f"Consult {consult.consult_id} – Status Update",
        message=f"Status changed from {old_status.value} to {status_update.status.value}.",
    )

    log_audit(
        db, AuditAction.STATUS_CHANGED, user_id=current_user.id,
        consult_id=consult.id,
        details=f"Status: {old_status.value} → {status_update.status.value}. {status_update.notes or ''}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(consult)
    return ConsultRequestOut.model_validate(consult)


@router.patch("/{consult_id}/acknowledge", response_model=ConsultRequestOut)
async def acknowledge_consult(
    consult_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT
    )),
):
    """Acknowledge receipt of consult (Stage 1 acknowledgement)."""
    consult = db.query(ConsultRequest).filter(ConsultRequest.id == consult_id).first()
    if not consult:
        raise HTTPException(status_code=404, detail="Consult not found")

    consult.acknowledged_by = current_user.id
    consult.acknowledged_at = datetime.utcnow()

    create_notification(
        db, consult.created_by, consult.id,
        title=f"Consult {consult.consult_id} Acknowledged",
        message=f"Acknowledged by {current_user.full_name} at {consult.acknowledged_at.strftime('%H:%M hrs')}.",
    )

    log_audit(
        db, AuditAction.MODIFIED, user_id=current_user.id,
        consult_id=consult.id,
        details=f"Consult acknowledged by {current_user.full_name}",
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(consult)
    return ConsultRequestOut.model_validate(consult)


@router.post("/sync", response_model=list[ConsultAcknowledgement])
async def sync_offline_consults(
    consults: list[ConsultRequestCreate],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk sync endpoint for offline consult submissions."""
    results = []
    for consult_data in consults:
        # Check duplicate
        if consult_data.client_id:
            existing = db.query(ConsultRequest).filter(
                ConsultRequest.client_id == consult_data.client_id
            ).first()
            if existing:
                results.append(ConsultAcknowledgement(
                    status="success",
                    consult_id=existing.consult_id,
                    received_at=existing.created_at,
                    message="Already synced.",
                ))
                continue

        consult_id = generate_consult_id(db)
        consult = ConsultRequest(
            consult_id=consult_id,
            **consult_data.model_dump(exclude={"client_id"}),
            status=ConsultStatus.PENDING,
            sync_status=SyncStatus.SYNCED,
            created_by=current_user.id,
            client_id=consult_data.client_id,
        )
        db.add(consult)
        db.flush()
        notify_plastic_surgery_team(db, consult)

        log_audit(
            db, AuditAction.CREATED, user_id=current_user.id,
            consult_id=consult.id,
            details=f"Offline sync: Consult {consult_id} created",
            ip_address=request.client.host if request.client else None,
        )

        results.append(ConsultAcknowledgement(
            status="success",
            consult_id=consult.consult_id,
            received_at=consult.created_at,
            message="Consult synced successfully.",
        ))

    db.commit()
    return results
