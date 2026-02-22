"""
PS Consult – UNTH: Vercel Serverless Entry Point

This file wraps our FastAPI app so Vercel's Python runtime
can serve it as a serverless function at /api/*
"""

import sys
import os

# Add backend directory to Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402

# Vercel expects a variable named `app` (or `handler`)
# FastAPI's ASGI app is picked up automatically by @vercel/python
