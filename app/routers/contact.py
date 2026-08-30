"""
Contact & Admin Auth router.

Rate limiting strategy:
  - Enquiry (public): sliding window per IP, thresholds from Settings.
  - Login (auth): per-IP + per-account exponential backoff.
    Tiers: base → base*2 → base*4 → ... capped at LOGIN_MAX_LOCKOUT_SECONDS.
    All thresholds configurable via environment variables (see config.py).
"""
import html
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, get_current_admin
from app.core.config import get_settings
from app.core.database import get_db
from app.core.email import build_enquiry_email, send_email_notification
from app.models.models import ClientEnquiry
from app.schemas.schemas import (
    EnquiryCreate,
    EnquiryOut,
    MessageResponse,
    TokenRequest,
    TokenResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/contact", tags=["Contact"])

# ── In-memory rate-limit stores ────────────────────────────────────────────────

# Enquiry: IP -> list[timestamp]
_enquiry_attempts: Dict[str, List[float]] = {}


# Login: keyed by (IP, username) -> LoginRecord
@dataclass
class _LoginRecord:
    failure_count: int = 0       # cumulative failures in current tier
    tier: int = 0                # how many times we've locked out so far
    window_start: float = 0.0    # start of the current failure window
    locked_until: float = 0.0   # epoch time when lockout expires


_login_records: Dict[str, _LoginRecord] = {}


# ── Helpers ────────────────────────────────────────────────────────────────────

def sanitize_input(text: str) -> str:
    """Escape HTML special characters to prevent XSS."""
    if not text:
        return ""
    return html.escape(text.strip())


def _login_key(ip: str, username: str) -> str:
    return f"{ip}::{username.lower()}"


def _check_login_rate_limit(ip: str, username: str) -> None:
    """
    Raise HTTP 429 if the caller is within a lockout window.
    Uses exponential backoff: lockout = base * 2^tier, capped at max.
    """
    cfg = get_settings()
    key = _login_key(ip, username)
    now = time.time()
    rec = _login_records.get(key)

    if rec is None:
        _login_records[key] = _LoginRecord(window_start=now)
        return

    # Still locked out?
    if rec.locked_until > now:
        remaining = int(rec.locked_until - now)
        logger.warning(
            "[AUTH] Login blocked for key=%s, lockout expires in %ds", key, remaining
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Try again in {remaining} seconds.",
        )

    # Sliding window expired — reset failure counter (but keep tier for next lockout)
    if now - rec.window_start > cfg.LOGIN_RATE_WINDOW_SECONDS:
        rec.failure_count = 0
        rec.window_start = now


def _record_login_failure(ip: str, username: str) -> None:
    """Increment failure count; escalate lockout tier if threshold exceeded."""
    cfg = get_settings()
    key = _login_key(ip, username)
    now = time.time()
    rec = _login_records.setdefault(key, _LoginRecord(window_start=now))

    rec.failure_count += 1

    if rec.failure_count >= cfg.LOGIN_RATE_LIMIT:
        lockout = min(
            cfg.LOGIN_BACKOFF_BASE_SECONDS * (2 ** rec.tier),
            cfg.LOGIN_MAX_LOCKOUT_SECONDS,
        )
        rec.locked_until = now + lockout
        rec.tier += 1
        rec.failure_count = 0
        rec.window_start = now
        logger.warning(
            "[AUTH] IP=%s user='%s' locked out for %ds (tier %d)",
            ip, username, lockout, rec.tier,
        )


def _clear_login_record(ip: str, username: str) -> None:
    """Clear rate-limit record on successful login."""
    _login_records.pop(_login_key(ip, username), None)


# ── Public: Enquiry ────────────────────────────────────────────────────────────

@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def submit_enquiry(
    data: EnquiryCreate, request: Request, db: Session = Depends(get_db)
):
    cfg = get_settings()
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Sliding-window rate limit (per IP)
    _enquiry_attempts.setdefault(ip, [])
    _enquiry_attempts[ip] = [
        t for t in _enquiry_attempts[ip]
        if now - t < cfg.ENQUIRY_RATE_WINDOW_SECONDS
    ]
    if len(_enquiry_attempts[ip]) >= cfg.ENQUIRY_RATE_LIMIT:
        logger.warning("[CONTACT] Rate limit exceeded for IP=%s", ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait a few minutes before submitting again.",
        )

    # Honeypot: silently succeed (don't reveal detection to bots)
    if data.website:
        logger.info("[CONTACT] Honeypot triggered from IP=%s email=%s", ip, data.email)
        return {"message": "Your custom quote request has been received! Our team will get back to you within 24 hours."}

    _enquiry_attempts[ip].append(now)

    # Sanitize
    clean_name = sanitize_input(data.name)
    clean_email = sanitize_input(data.email)
    clean_phone = sanitize_input(data.phone)
    clean_project_type = sanitize_input(data.project_type)
    clean_budget_range = sanitize_input(data.budget_range)
    clean_event_date = sanitize_input(data.event_date)
    clean_message = sanitize_input(data.message)

    # Persist
    enquiry = ClientEnquiry(
        name=clean_name,
        email=clean_email,
        phone=clean_phone,
        project_type=clean_project_type,
        budget_range=clean_budget_range,
        event_date=clean_event_date,
        message=clean_message,
    )
    try:
        db.add(enquiry)
        db.commit()
        db.refresh(enquiry)
    except Exception as first_err:
        logger.warning("[CONTACT] First DB commit failed, rolling back: %s", first_err)
        db.rollback()
        try:
            db.add(enquiry)
            db.commit()
            db.refresh(enquiry)
        except Exception as second_err:
            logger.error("[CONTACT] Second DB commit also failed: %s", second_err)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to process your request at this time. Please try again later.",
            )

    # Email notification (non-blocking)
    try:
        html_body = build_enquiry_email(
            name=clean_name,
            email=clean_email,
            phone=clean_phone,
            project_type=clean_project_type,
            budget_range=clean_budget_range,
            event_date=clean_event_date,
            message=clean_message,
        )
        send_email_notification(
            subject=f"New Custom Quote Request from {clean_name} — {clean_project_type}",
            body_html=html_body,
        )
    except Exception as exc:
        logger.warning("[CONTACT] Email notification failed: %s", exc)

    # Web3Forms notification
    try:
        import json
        import urllib.request

        web3_key = cfg.WEB3FORMS_KEY
        if not web3_key:
            logger.info("[WEB3FORMS] WEB3FORMS_KEY not configured; skipping dispatch")
        else:
            web3_payload = {
                "access_key": web3_key,
                "subject": f"✨ New Custom Quote Request from {clean_name} ({clean_project_type})",
                "from_name": "The Sparqlane Portal",
                "to_email": cfg.EMAIL_TO,
                "name": clean_name,
                "email": clean_email,
                "phone": clean_phone,
                "project_type": clean_project_type,
                "budget_range": clean_budget_range,
                "category": clean_event_date,
                "message": clean_message,
            }
            req = urllib.request.Request(
                "https://api.web3forms.com/submit",
                data=json.dumps(web3_payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            urllib.request.urlopen(req, timeout=5)
            logger.info("[WEB3FORMS] Notification dispatched for %s", clean_name)
    except Exception as w3err:
        logger.warning("[WEB3FORMS] Dispatch failed (non-critical): %s", w3err)

    return {"message": "Your custom quote request has been received! Our team will get back to you within 24 hours."}


# ── Auth ───────────────────────────────────────────────────────────────────────

@router.post("/admin/token", response_model=TokenResponse)
def admin_login(data: TokenRequest, request: Request):
    cfg = get_settings()
    ip = request.client.host if request.client else "unknown"

    # Check rate limit (per IP + per account)
    _check_login_rate_limit(ip, data.username)

    logger.info(
        "[AUTH] Login attempt for user='%s' from IP=%s at %s",
        data.username,
        ip,
        datetime.now(timezone.utc).isoformat(),
    )

    # Validate credentials
    if data.username != cfg.SPARQLANE_ADMIN_USERNAME or data.password != cfg.SPARQLANE_ADMIN_PASSWORD:
        _record_login_failure(ip, data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    _clear_login_record(ip, data.username)
    token = create_access_token({"sub": data.username})
    return {"access_token": token, "token_type": "bearer"}


# ── Admin Enquiries ────────────────────────────────────────────────────────────

@router.get("/admin/enquiries", response_model=list[EnquiryOut])
def get_enquiries(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    return db.query(ClientEnquiry).order_by(ClientEnquiry.received_at.desc()).all()


@router.patch("/admin/enquiries/{enquiry_id}/read", response_model=EnquiryOut)
def mark_enquiry_read(
    enquiry_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    enquiry = db.query(ClientEnquiry).filter(ClientEnquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    enquiry.is_read = not enquiry.is_read
    db.commit()
    db.refresh(enquiry)
    return enquiry
