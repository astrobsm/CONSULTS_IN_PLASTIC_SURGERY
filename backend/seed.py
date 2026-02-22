"""
PS Consult – UNTH: Database Seed Script

Seeds initial data:
- Admin user
- Sample users with different roles
- Unit schedule (UNTH Plastic Surgery)
"""

from database import SessionLocal, engine, Base
from models import User, UnitSchedule, UserRole, ServiceType
from auth import get_password_hash


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Users ─────────────────────────────────────────────────
        if db.query(User).count() == 0:
            users = [
                User(
                    username="admin",
                    hashed_password=get_password_hash("admin123"),
                    full_name="System Administrator",
                    role=UserRole.ADMIN,
                    unit="Administration",
                    is_active=True,
                ),
                User(
                    username="ps_registrar",
                    hashed_password=get_password_hash("registrar123"),
                    full_name="Dr. Chukwudi Okafor",
                    role=UserRole.REGISTRAR,
                    unit="Plastic Surgery",
                    phone_number="08012345678",
                    is_active=True,
                ),
                User(
                    username="ps_senior_reg",
                    hashed_password=get_password_hash("senreg123"),
                    full_name="Dr. Ngozi Eze",
                    role=UserRole.SENIOR_REGISTRAR,
                    unit="Plastic Surgery",
                    phone_number="08023456789",
                    is_active=True,
                ),
                User(
                    username="ps_consultant",
                    hashed_password=get_password_hash("consultant123"),
                    full_name="Dr. Okwesili",
                    role=UserRole.CONSULTANT,
                    unit="Plastic Surgery",
                    phone_number="08034567890",
                    is_active=True,
                ),
                User(
                    username="ortho_unit",
                    hashed_password=get_password_hash("ortho123"),
                    full_name="Orthopaedic Unit",
                    role=UserRole.INVITING_UNIT,
                    unit="Orthopaedic Surgery",
                    phone_number="08045678901",
                    is_active=True,
                ),
                User(
                    username="gen_surgery",
                    hashed_password=get_password_hash("gensurg123"),
                    full_name="General Surgery Unit",
                    role=UserRole.INVITING_UNIT,
                    unit="General Surgery",
                    phone_number="08056789012",
                    is_active=True,
                ),
                User(
                    username="paediatrics",
                    hashed_password=get_password_hash("paeds123"),
                    full_name="Paediatrics Unit",
                    role=UserRole.INVITING_UNIT,
                    unit="Paediatrics",
                    phone_number="08067890123",
                    is_active=True,
                ),
                User(
                    username="emergency",
                    hashed_password=get_password_hash("emergency123"),
                    full_name="Emergency Unit",
                    role=UserRole.INVITING_UNIT,
                    unit="Accident & Emergency",
                    phone_number="08078901234",
                    is_active=True,
                ),
            ]
            db.add_all(users)
            db.commit()
            print(f"✅ Seeded {len(users)} users")
        else:
            print("ℹ️  Users already exist, skipping")

        # ── Unit Schedule ─────────────────────────────────────────
        if db.query(UnitSchedule).count() == 0:
            schedules = [
                # Clinic Days
                UnitSchedule(
                    service_type=ServiceType.CLINIC,
                    day_of_week="Tuesday",
                    start_time="09:00",
                    end_time="14:00",
                    location="PS Clinic, OPD Complex",
                    notes="Drs Okwesili & Nnadi",
                    is_active=True,
                ),
                UnitSchedule(
                    service_type=ServiceType.CLINIC,
                    day_of_week="Wednesday",
                    start_time="09:00",
                    end_time="14:00",
                    location="PS Clinic, OPD Complex",
                    notes="Dr Okwesili & Dr Eze",
                    is_active=True,
                ),
                # Theatre Days
                UnitSchedule(
                    service_type=ServiceType.THEATRE,
                    day_of_week="Wednesday",
                    start_time="08:00",
                    end_time="16:00",
                    location="Main Theatre, Suite 3",
                    notes="Drs Okwesili & Nnadi",
                    is_active=True,
                ),
                UnitSchedule(
                    service_type=ServiceType.THEATRE,
                    day_of_week="Thursday",
                    start_time="08:00",
                    end_time="16:00",
                    location="Main Theatre, Suite 3",
                    notes="Dr Okwesili & Dr Eze",
                    is_active=True,
                ),
                # Ward Rounds
                UnitSchedule(
                    service_type=ServiceType.WARD_ROUND,
                    day_of_week="Monday",
                    start_time="08:00",
                    end_time="10:00",
                    location="Ward C4",
                    notes="Consultants' Ward Round",
                    is_active=True,
                ),
                UnitSchedule(
                    service_type=ServiceType.WARD_ROUND,
                    day_of_week="Friday",
                    start_time="08:00",
                    end_time="10:00",
                    location="Ward C4",
                    notes="Senior Residents' Ward Round",
                    is_active=True,
                ),
            ]
            db.add_all(schedules)
            db.commit()
            print(f"✅ Seeded {len(schedules)} schedule entries")
        else:
            print("ℹ️  Schedules already exist, skipping")

        print("\n🏥 PS Consult – UNTH: Database seeding complete!")
        print("\n📋 Default Login Credentials:")
        print("   Admin:       admin / admin123")
        print("   Registrar:   ps_registrar / registrar123")
        print("   Sr Registrar: ps_senior_reg / senreg123")
        print("   Consultant:  ps_consultant / consultant123")
        print("   Ortho Unit:  ortho_unit / ortho123")
        print("   Gen Surgery: gen_surgery / gensurg123")
        print("   Paediatrics: paediatrics / paeds123")
        print("   Emergency:   emergency / emergency123")
        print("\n⚠️  CHANGE ALL PASSWORDS IN PRODUCTION!")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
