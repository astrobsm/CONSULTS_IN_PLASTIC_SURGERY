"""
PS Consult – UNTH: Main FastAPI Application

Plastic Surgery Consult System – University of Nigeria Teaching Hospital, Ituku-Ozalla
Deployment: Vercel (serverless) + Supabase (PostgreSQL)
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from routers.auth_router import router as auth_router
from routers.consults_router import router as consults_router
from routers.reviews_router import router as reviews_router
from routers.dashboard_router import router as dashboard_router
from routers.schedule_router import router as schedule_router

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


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
