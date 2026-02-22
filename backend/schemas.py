"""
PS Consult – UNTH: Pydantic Schemas for Request/Response Validation
"""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from models import (
    UserRole, UrgencyLevel, ConsultStatus, Designation,
    WoundClassification, WoundPhase, ServiceType, SyncStatus
)


# ──────────────────────────────────────────────────────────────────
# Auth Schemas
# ──────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# ──────────────────────────────────────────────────────────────────
# User Schemas
# ──────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = UserRole.INVITING_UNIT
    unit: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: UserRole
    unit: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    unit: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


# ──────────────────────────────────────────────────────────────────
# Consult Request Schemas
# ──────────────────────────────────────────────────────────────────

class ConsultRequestCreate(BaseModel):
    # Patient Information
    patient_name: str = Field(..., min_length=2, max_length=255)
    hospital_number: str = Field(..., min_length=1, max_length=50)
    age: int = Field(..., ge=0, le=150)
    sex: str = Field(..., pattern=r"^(Male|Female)$")
    ward: str = Field(..., min_length=1, max_length=100)
    bed_number: str = Field(..., min_length=1, max_length=20)
    date_of_admission: date
    primary_diagnosis: str = Field(..., min_length=2)
    indication: str = Field(..., min_length=2)
    indication_category: Optional[str] = None
    urgency: UrgencyLevel = UrgencyLevel.ROUTINE

    # Consulting Unit Details
    inviting_unit: str = Field(..., min_length=2, max_length=255)
    consultant_in_charge: str = Field(..., min_length=2, max_length=255)
    requesting_doctor: str = Field(..., min_length=2, max_length=255)
    designation: Designation
    phone_number: str = Field(..., min_length=7, max_length=20)
    alternate_phone: Optional[str] = None

    # Offline tracking
    client_id: Optional[str] = None


class ConsultRequestOut(BaseModel):
    id: int
    consult_id: str
    patient_name: str
    hospital_number: str
    age: int
    sex: str
    ward: str
    bed_number: str
    date_of_admission: date
    primary_diagnosis: str
    indication: str
    indication_category: Optional[str] = None
    urgency: UrgencyLevel
    inviting_unit: str
    consultant_in_charge: str
    requesting_doctor: str
    designation: Designation
    phone_number: str
    alternate_phone: Optional[str] = None
    status: ConsultStatus
    sync_status: SyncStatus
    notification_sent: bool
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    accepted_by: Optional[int] = None
    accepted_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    client_id: Optional[str] = None
    creator: Optional[UserOut] = None

    class Config:
        from_attributes = True


class ConsultStatusUpdate(BaseModel):
    status: ConsultStatus
    notes: Optional[str] = None


class ConsultListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    consults: list[ConsultRequestOut]


# ──────────────────────────────────────────────────────────────────
# Review Schemas
# ──────────────────────────────────────────────────────────────────

class ConsultReviewCreate(BaseModel):
    assessment_notes: str = Field(..., min_length=5)
    wound_classification: Optional[WoundClassification] = None
    wound_phase: Optional[WoundPhase] = None
    wound_length: Optional[float] = Field(None, ge=0)
    wound_width: Optional[float] = Field(None, ge=0)
    wound_depth: Optional[float] = Field(None, ge=0)
    wound_location: Optional[str] = None
    management_plan: str = Field(..., min_length=5)
    procedure_scheduled: bool = False
    procedure_date: Optional[date] = None
    procedure_details: Optional[str] = None
    follow_up_date: Optional[date] = None
    follow_up_notes: Optional[str] = None


class ConsultReviewOut(BaseModel):
    id: int
    consult_id: int
    reviewed_by: int
    assessment_notes: str
    wound_classification: Optional[WoundClassification] = None
    wound_phase: Optional[WoundPhase] = None
    wound_length: Optional[float] = None
    wound_width: Optional[float] = None
    wound_depth: Optional[float] = None
    wound_location: Optional[str] = None
    management_plan: str
    procedure_scheduled: bool
    procedure_date: Optional[date] = None
    procedure_details: Optional[str] = None
    follow_up_date: Optional[date] = None
    follow_up_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reviewer: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Schedule Schemas
# ──────────────────────────────────────────────────────────────────

class UnitScheduleCreate(BaseModel):
    service_type: ServiceType
    day_of_week: str = Field(..., pattern=r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$")
    start_time: str = Field(default="08:00")
    end_time: str = Field(default="12:00")
    location: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class UnitScheduleOut(BaseModel):
    id: int
    service_type: ServiceType
    day_of_week: str
    start_time: str
    end_time: str
    location: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Notification Schemas
# ──────────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    user_id: int
    consult_id: Optional[int] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Audit Log Schema
# ──────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    consult_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Dashboard / Analytics Schemas
# ──────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_consults: int
    pending: int
    accepted: int
    reviewed: int
    procedure_planned: int
    completed: int
    emergency_count: int
    today_count: int


class ConsultAcknowledgement(BaseModel):
    status: str
    consult_id: str
    received_at: datetime
    message: str


# Forward reference resolution
Token.model_rebuild()
