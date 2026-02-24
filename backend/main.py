"""
PS Consult – UNTH: Main FastAPI Application

Plastic Surgery Consult System – University of Nigeria Teaching Hospital, Ituku-Ozalla
Deployment: Vercel (serverless) + Supabase (PostgreSQL)
"""

import os
import base64
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from config import settings
from database import engine, Base, get_db
from models import Photo
from routers.auth_router import router as auth_router
from routers.consults_router import router as consults_router
from routers.reviews_router import router as reviews_router
from routers.dashboard_router import router as dashboard_router
from routers.schedule_router import router as schedule_router
from routers.push_router import router as push_router

# Create database tables on startup
# Uses lifespan to handle gracefully when DB is not yet configured
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    """Application lifespan handler.
    
    Note: Table creation is skipped in production (Vercel serverless)
    to avoid cold-start latency. Tables should be created via
    migration scripts or the seed.py utility.
    """
    import logging
    if os.getenv("VERCEL"):
        logging.info("Vercel detected — skipping create_all for fast cold start")
    else:
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logging.warning(f"Could not create tables (DB may not be configured yet): {e}")
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS – allow all origins (frontend and API served from same Vercel domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(consults_router)
app.include_router(reviews_router)
app.include_router(dashboard_router)
app.include_router(schedule_router)
app.include_router(push_router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/api/photos/{photo_id}")
async def serve_photo(photo_id: int, db: Session = Depends(get_db)):
    """Serve a single photo as a binary image response.

    This avoids embedding large base64 strings in JSON responses,
    keeping list endpoints fast and under Vercel's response size limit.
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    image_data = base64.b64decode(photo.data)
    return Response(
        content=image_data,
        media_type=photo.content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
