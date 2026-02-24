"""
PS Consult – UNTH: Application Configuration
"""

import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    APP_NAME: str = "PS Consult – UNTH"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Plastic Surgery Consult System – University of Nigeria Teaching Hospital"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/ps_consult"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # Web Push (VAPID) — set via environment variables in production
    VAPID_PRIVATE_KEY: str = os.getenv(
        "VAPID_PRIVATE_KEY",
        "ZWq3h0H8V0zo_jAQTJp4lp5mC0Nc56TfDZW7WHnKcco"
    )
    VAPID_PUBLIC_KEY: str = os.getenv(
        "VAPID_PUBLIC_KEY",
        "BGmB4AXEVBI1P7sBJNr0x9VWxBHW4DAP_DTB2ieCt02hgXGRCePmibDJmDlfa4RJEbnCND_o-uW39oWA6IHIXZQ"
    )
    VAPID_CLAIMS_EMAIL: str = os.getenv(
        "VAPID_CLAIMS_EMAIL",
        "mailto:ps-consult@unth.edu.ng"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
