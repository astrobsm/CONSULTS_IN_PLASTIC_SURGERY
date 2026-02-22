"""
PS Consult – UNTH: Unit Schedule Router

Manages the Plastic Surgery Unit service schedule.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import UnitSchedule, User, UserRole
from schemas import UnitScheduleCreate, UnitScheduleOut
from auth import get_current_user, require_roles

router = APIRouter(prefix="/api/schedule", tags=["Unit Schedule"])

# Day-of-week mapping for contextual messages
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_today_name() -> str:
    return DAYS[datetime.utcnow().weekday()]


@router.get("/", response_model=list[UnitScheduleOut])
async def get_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all active schedule entries."""
    schedules = (
        db.query(UnitSchedule)
        .filter(UnitSchedule.is_active == True)
        .order_by(UnitSchedule.service_type, UnitSchedule.day_of_week)
        .all()
    )
    return [UnitScheduleOut.model_validate(s) for s in schedules]


@router.get("/today")
async def get_today_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get today's schedule with contextual information."""
    today = get_today_name()
    schedules = (
        db.query(UnitSchedule)
        .filter(UnitSchedule.is_active == True, UnitSchedule.day_of_week == today)
        .all()
    )

    # Build contextual message
    activities = []
    for s in schedules:
        label = s.service_type.value.replace('_', ' ').title()
        activities.append(f"{label}: {s.start_time}–{s.end_time}" + (f" @ {s.location}" if s.location else ""))

    message = f"Today is {today}."
    if activities:
        message += " Scheduled activities: " + "; ".join(activities) + "."
    else:
        message += " No specific activities scheduled."

    # Find next clinic and theatre days
    all_schedules = (
        db.query(UnitSchedule)
        .filter(UnitSchedule.is_active == True)
        .all()
    )

    today_idx = DAYS.index(today)
    next_clinic = None
    next_theatre = None

    for offset in range(1, 8):
        day = DAYS[(today_idx + offset) % 7]
        for s in all_schedules:
            if s.day_of_week == day:
                if s.service_type.value == "clinic" and not next_clinic:
                    next_clinic = f"{day} – {s.start_time}"
                if s.service_type.value == "theatre" and not next_theatre:
                    next_theatre = f"{day} – {s.start_time}"
        if next_clinic and next_theatre:
            break

    return {
        "today": today,
        "today_schedule": [UnitScheduleOut.model_validate(s) for s in schedules],
        "contextual_message": message,
        "next_clinic": next_clinic,
        "next_theatre": next_theatre,
    }


@router.post("/", response_model=UnitScheduleOut, status_code=201)
async def create_schedule(
    schedule_data: UnitScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CONSULTANT)),
):
    """Create a new schedule entry (admin only)."""
    schedule = UnitSchedule(**schedule_data.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return UnitScheduleOut.model_validate(schedule)


@router.put("/{schedule_id}", response_model=UnitScheduleOut)
async def update_schedule(
    schedule_id: int,
    schedule_data: UnitScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CONSULTANT)),
):
    """Update a schedule entry."""
    schedule = db.query(UnitSchedule).filter(UnitSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in schedule_data.model_dump().items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)
    return UnitScheduleOut.model_validate(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.CONSULTANT)),
):
    """Deactivate a schedule entry."""
    schedule = db.query(UnitSchedule).filter(UnitSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.is_active = False
    db.commit()
    return {"status": "ok"}
