"""
PS Consult – UNTH: Dashboard & Analytics Router
"""

from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    ConsultRequest, ConsultStatus, UrgencyLevel, User, UserRole,
    Notification, AuditLog
)
from schemas import DashboardStats, NotificationOut, AuditLogOut
from auth import get_current_user, require_roles

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard statistics for the Plastic Surgery team."""
    today = date.today()

    base_query = db.query(ConsultRequest)
    if current_user.role == UserRole.INVITING_UNIT:
        base_query = base_query.filter(ConsultRequest.created_by == current_user.id)

    total = base_query.count()
    pending = base_query.filter(ConsultRequest.status == ConsultStatus.PENDING).count()
    accepted = base_query.filter(ConsultRequest.status == ConsultStatus.ACCEPTED).count()
    reviewed = base_query.filter(ConsultRequest.status == ConsultStatus.REVIEWED).count()
    procedure_planned = base_query.filter(ConsultRequest.status == ConsultStatus.PROCEDURE_PLANNED).count()
    completed = base_query.filter(ConsultRequest.status == ConsultStatus.COMPLETED).count()
    emergency_count = base_query.filter(ConsultRequest.urgency == UrgencyLevel.EMERGENCY).count()
    today_count = base_query.filter(func.date(ConsultRequest.created_at) == today).count()

    return DashboardStats(
        total_consults=total,
        pending=pending,
        accepted=accepted,
        reviewed=reviewed,
        procedure_planned=procedure_planned,
        completed=completed,
        emergency_count=emergency_count,
        today_count=today_count,
    )


@router.get("/analytics/by-ward")
async def analytics_by_ward(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN
    )),
):
    """Consult distribution by ward."""
    results = (
        db.query(ConsultRequest.ward, func.count(ConsultRequest.id))
        .group_by(ConsultRequest.ward)
        .order_by(func.count(ConsultRequest.id).desc())
        .all()
    )
    return [{"ward": ward, "count": count} for ward, count in results]


@router.get("/analytics/by-urgency")
async def analytics_by_urgency(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN
    )),
):
    """Consult distribution by urgency."""
    results = (
        db.query(ConsultRequest.urgency, func.count(ConsultRequest.id))
        .group_by(ConsultRequest.urgency)
        .all()
    )
    return [{"urgency": urg.value, "count": count} for urg, count in results]


@router.get("/analytics/response-times")
async def analytics_response_times(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN
    )),
):
    """Average response times for consults."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    consults = (
        db.query(ConsultRequest)
        .filter(
            ConsultRequest.created_at >= cutoff,
            ConsultRequest.accepted_at.isnot(None),
        )
        .all()
    )

    if not consults:
        return {"average_response_minutes": 0, "count": 0}

    total_minutes = sum(
        (c.accepted_at - c.created_at).total_seconds() / 60
        for c in consults
    )
    avg = total_minutes / len(consults)

    return {
        "average_response_minutes": round(avg, 1),
        "count": len(consults),
        "period_days": days,
    }


@router.get("/analytics/daily-trend")
async def daily_trend(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN
    )),
):
    """Daily consult trend."""
    cutoff = date.today() - timedelta(days=days)
    results = (
        db.query(
            func.date(ConsultRequest.created_at).label("day"),
            func.count(ConsultRequest.id).label("count"),
        )
        .filter(func.date(ConsultRequest.created_at) >= cutoff)
        .group_by(func.date(ConsultRequest.created_at))
        .order_by(func.date(ConsultRequest.created_at))
        .all()
    )
    return [{"date": str(day), "count": count} for day, count in results]


# ──────────────────────────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationOut])
async def get_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for current user."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return [NotificationOut.model_validate(n) for n in notifications]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok"}


@router.patch("/notifications/read-all")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────────────────────────
# Audit Logs
# ──────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=list[AuditLogOut])
async def get_audit_logs(
    consult_id: int = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CONSULTANT)),
):
    """Get audit logs (admin/consultant only)."""
    query = db.query(AuditLog)
    if consult_id:
        query = query.filter(AuditLog.consult_id == consult_id)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [AuditLogOut.model_validate(log) for log in logs]
