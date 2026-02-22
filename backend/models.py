"""
PS Consult – UNTH: SQLAlchemy Database Models

Tables:
- users: Hospital staff accounts with role-based access
- consult_requests: Core consult request records
- consult_reviews: Plastic surgery team review documentation
- audit_logs: Medico-legal audit trail
- unit_schedules: Department service schedule
- notifications: Alert/notification records
- photos: Wound photo records
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Enum, ForeignKey, Float, Date
)
from sqlalchemy.orm import relationship
from database import Base


# ──────────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    INVITING_UNIT = "inviting_unit"
    REGISTRAR = "registrar"
    SENIOR_REGISTRAR = "senior_registrar"
    CONSULTANT = "consultant"
    ADMIN = "admin"


class UrgencyLevel(str, enum.Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class ConsultStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    ON_THE_WAY = "on_the_way"
    REVIEWED = "reviewed"
    PROCEDURE_PLANNED = "procedure_planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Designation(str, enum.Enum):
    HOUSE_OFFICER = "HO"
    REGISTRAR = "Registrar"
    SENIOR_REGISTRAR = "Senior Registrar"


class WoundClassification(str, enum.Enum):
    CLEAN = "clean"
    CLEAN_CONTAMINATED = "clean_contaminated"
    CONTAMINATED = "contaminated"
    DIRTY_INFECTED = "dirty_infected"


class WoundPhase(str, enum.Enum):
    HEMOSTASIS = "hemostasis"
    INFLAMMATORY = "inflammatory"
    PROLIFERATIVE = "proliferative"
    REMODELING = "remodeling"


class ServiceType(str, enum.Enum):
    CLINIC = "clinic"
    THEATRE = "theatre"
    WARD_ROUND = "ward_round"


class AuditAction(str, enum.Enum):
    CREATED = "created"
    MODIFIED = "modified"
    STATUS_CHANGED = "status_changed"
    REVIEWED = "reviewed"
    DELETED = "deleted"
    LOGIN = "login"
    LOGOUT = "logout"


class SyncStatus(str, enum.Enum):
    SYNCED = "synced"
    PENDING = "pending"
    CONFLICT = "conflict"


# ──────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.INVITING_UNIT)
    unit = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    consults_created = relationship("ConsultRequest", back_populates="creator", foreign_keys="ConsultRequest.created_by")
    reviews = relationship("ConsultReview", back_populates="reviewer")
    audit_logs = relationship("AuditLog", back_populates="user")


class ConsultRequest(Base):
    __tablename__ = "consult_requests"

    id = Column(Integer, primary_key=True, index=True)
    consult_id = Column(String(50), unique=True, index=True, nullable=False)  # PSC-2026-00001

    # Patient Information
    patient_name = Column(String(255), nullable=False)
    hospital_number = Column(String(50), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    sex = Column(String(10), nullable=False)
    ward = Column(String(100), nullable=False)
    bed_number = Column(String(20), nullable=False)
    date_of_admission = Column(Date, nullable=False)
    primary_diagnosis = Column(Text, nullable=False)
    indication = Column(Text, nullable=False)
    indication_category = Column(String(100), nullable=True)
    urgency = Column(Enum(UrgencyLevel), nullable=False, default=UrgencyLevel.ROUTINE)

    # Consulting Unit Details
    inviting_unit = Column(String(255), nullable=False)
    consultant_in_charge = Column(String(255), nullable=False)
    requesting_doctor = Column(String(255), nullable=False)
    designation = Column(Enum(Designation), nullable=False)
    phone_number = Column(String(20), nullable=False)
    alternate_phone = Column(String(20), nullable=True)

    # Status & Tracking
    status = Column(Enum(ConsultStatus), nullable=False, default=ConsultStatus.PENDING)
    sync_status = Column(Enum(SyncStatus), nullable=False, default=SyncStatus.SYNCED)
    notification_sent = Column(Boolean, default=False)

    # Acknowledgement fields
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    accepted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime, nullable=True)

    # Timestamps
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # null for public/open-access consults
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Offline tracking
    client_id = Column(String(100), nullable=True)  # For offline conflict resolution

    # Relationships
    creator = relationship("User", back_populates="consults_created", foreign_keys=[created_by])
    acknowledger = relationship("User", foreign_keys=[acknowledged_by])
    accepter = relationship("User", foreign_keys=[accepted_by])
    reviews = relationship("ConsultReview", back_populates="consult", cascade="all, delete-orphan")
    photos = relationship("Photo", back_populates="consult", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="consult")


class ConsultReview(Base):
    __tablename__ = "consult_reviews"

    id = Column(Integer, primary_key=True, index=True)
    consult_id = Column(Integer, ForeignKey("consult_requests.id"), nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Assessment
    assessment_notes = Column(Text, nullable=False)
    wound_classification = Column(Enum(WoundClassification), nullable=True)
    wound_phase = Column(Enum(WoundPhase), nullable=True)

    # Wound Measurement
    wound_length = Column(Float, nullable=True)
    wound_width = Column(Float, nullable=True)
    wound_depth = Column(Float, nullable=True)
    wound_location = Column(String(255), nullable=True)

    # Management
    management_plan = Column(Text, nullable=False)
    procedure_scheduled = Column(Boolean, default=False)
    procedure_date = Column(Date, nullable=True)
    procedure_details = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)
    follow_up_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    consult = relationship("ConsultRequest", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    consult_id = Column(Integer, ForeignKey("consult_requests.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False, default="image/jpeg")
    data = Column(Text, nullable=False)  # base64-encoded image data
    description = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    consult = relationship("ConsultRequest", back_populates="photos")
    uploader = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    consult_id = Column(Integer, ForeignKey("consult_requests.id"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
    consult = relationship("ConsultRequest", back_populates="audit_logs")


class UnitSchedule(Base):
    __tablename__ = "unit_schedules"

    id = Column(Integer, primary_key=True, index=True)
    service_type = Column(Enum(ServiceType), nullable=False)
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday, etc.
    start_time = Column(String(10), nullable=False, default="08:00")
    end_time = Column(String(10), nullable=False, default="12:00")
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    consult_id = Column(Integer, ForeignKey("consult_requests.id"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")
    consult = relationship("ConsultRequest")
