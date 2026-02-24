"""
PS Consult – UNTH: Web Push Notifications Router

Manages push subscription registration and sends real-time
browser push notifications even when the app is closed.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException

from database import get_db
from models import PushSubscription, User, UserRole
from config import settings
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/push", tags=["Push Notifications"])


# ── Public: Get VAPID public key ──────────────────────
@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe."""
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


# ── Subscribe (no auth required — guests can subscribe too) ──
@router.post("/subscribe")
async def subscribe(request: Request, db: Session = Depends(get_db)):
    """Register a push subscription.

    Accepts the PushSubscription JSON from the browser Push API.
    Works for both authenticated users and anonymous visitors.
    """
    body = await request.json()
    endpoint = body.get("endpoint")
    keys = body.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Invalid push subscription data")

    # Try to get user from token (optional — may be anonymous)
    user_id = None
    try:
        from auth import get_current_user_optional
        user = await get_current_user_optional(request, db)
        if user:
            user_id = user.id
    except Exception:
        pass

    # Upsert — update existing subscription or create new
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint
    ).first()

    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
        if user_id:
            existing.user_id = user_id
    else:
        sub = PushSubscription(
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            user_id=user_id,
        )
        db.add(sub)

    db.commit()
    return {"status": "subscribed"}


# ── Unsubscribe ──────────────────────────────────────
@router.post("/unsubscribe")
async def unsubscribe(request: Request, db: Session = Depends(get_db)):
    """Remove a push subscription."""
    body = await request.json()
    endpoint = body.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Missing endpoint")

    sub = db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"status": "unsubscribed"}


# ── Helper: send push to all subscribers ─────────────
def send_push_to_all(db: Session, title: str, body: str, url: str = "/", tag: str = "ps-consult"):
    """Send a push notification to ALL registered subscribers.

    Called internally when a new consult is submitted.
    Stale/expired subscriptions are automatically cleaned up.
    """
    subscriptions = db.query(PushSubscription).all()
    if not subscriptions:
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    })

    stale_ids = []
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            # 410 Gone or 404 = subscription expired, clean it up
            if hasattr(e, 'response') and e.response is not None:
                status = e.response.status_code
                if status in (404, 410):
                    stale_ids.append(sub.id)
                    continue
            logger.warning(f"Push failed for {sub.endpoint[:50]}...: {e}")
        except Exception as e:
            logger.warning(f"Push error: {e}")

    # Clean up stale subscriptions
    if stale_ids:
        db.query(PushSubscription).filter(
            PushSubscription.id.in_(stale_ids)
        ).delete(synchronize_session=False)
        db.commit()


def send_push_to_team(db: Session, title: str, body: str, url: str = "/", tag: str = "ps-consult"):
    """Send push notification only to plastic surgery team members."""
    team_roles = [UserRole.REGISTRAR, UserRole.SENIOR_REGISTRAR, UserRole.CONSULTANT, UserRole.ADMIN]
    team_subs = (
        db.query(PushSubscription)
        .join(User, PushSubscription.user_id == User.id)
        .filter(User.role.in_(team_roles), User.is_active == True)
        .all()
    )

    # Also include anonymous subscriptions (no user_id) — these may be
    # team members who subscribed before logging in
    anon_subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == None
    ).all()

    all_subs = team_subs + anon_subs
    if not all_subs:
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
    })

    stale_ids = []
    for sub in all_subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            )
        except WebPushException as e:
            if hasattr(e, 'response') and e.response is not None:
                status = e.response.status_code
                if status in (404, 410):
                    stale_ids.append(sub.id)
                    continue
            logger.warning(f"Push failed for {sub.endpoint[:50]}...: {e}")
        except Exception as e:
            logger.warning(f"Push error: {e}")

    if stale_ids:
        db.query(PushSubscription).filter(
            PushSubscription.id.in_(stale_ids)
        ).delete(synchronize_session=False)
        db.commit()
