from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_admin, create_access_token
from app.core.config import get_settings
from app.core.email import send_email_notification, build_enquiry_email
from app.models.models import ClientEnquiry
from app.schemas.schemas import (
    EnquiryCreate, EnquiryOut, TokenRequest, TokenResponse, MessageResponse,
)

import html

router = APIRouter(prefix="/api/contact", tags=["Contact"])

# In-memory stores for rate limiting: IP -> list of floats (timestamps)
login_attempts = {}
enquiry_attempts = {}


def sanitize_input(text: str) -> str:
    """Sanitize string inputs to prevent XSS and HTML injection."""
    if not text:
        return ""
    # Strip dangerous HTML tags and escape remaining special characters
    clean = html.escape(text.strip())
    return clean


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def submit_enquiry(data: EnquiryCreate, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    current_time = time.time()

    # Rate limiting: max 5 submissions per 10 minutes per IP
    if ip not in enquiry_attempts:
        enquiry_attempts[ip] = []
    enquiry_attempts[ip] = [t for t in enquiry_attempts[ip] if current_time - t < 600]

    if len(enquiry_attempts[ip]) >= 5:
        print(f"[SECURITY] Rate limit exceeded for quote submission from IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many quote requests submitted. Please wait a few minutes before submitting again.",
        )

    # Honeypot spam check: if website is filled, discard submission silently but return success
    if data.website:
        print(f"[SPAM DETECTED] Discarding spam submission from {data.email} with honeypot field filled.")
        return {"message": "Your custom quote request has been received! Our team will get back to you within 24 hours."}

    enquiry_attempts[ip].append(current_time)

    # Sanitize inputs for security
    clean_name = sanitize_input(data.name)
    clean_email = sanitize_input(data.email)
    clean_phone = sanitize_input(data.phone)
    clean_project_type = sanitize_input(data.project_type)
    clean_budget_range = sanitize_input(data.budget_range)
    clean_event_date = sanitize_input(data.event_date)
    clean_message = sanitize_input(data.message)

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
    except Exception as dberr:
        db.rollback()
        print(f"[DATABASE NOTICE] Retrying commit after stale connection reset: {dberr}")
        db.add(enquiry)
        db.commit()
        db.refresh(enquiry)

    # Send email notification (non-blocking, won't crash on failure)
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
        print(f"[CONTACT] Email notification failed: {exc}")

    # Direct Web3Forms notification to thesparqlane@gmail.com
    try:
        import urllib.request
        import json
        settings = get_settings()
        web3_key = settings.WEB3FORMS_KEY or "599dfed0-1282-4fdf-b98a-web3formskey"
        web3_payload = {
            "access_key": web3_key,
            "subject": f"✨ New Custom Quote Request from {clean_name} ({clean_project_type})",
            "from_name": "The Sparqlane Portal",
            "to_email": "thesparqlane@gmail.com",
            "name": clean_name,
            "email": clean_email,
            "phone": clean_phone,
            "project_type": clean_project_type,
            "budget_range": clean_budget_range,
            "category": clean_event_date,
            "message": clean_message
        }
        req = urllib.request.Request(
            "https://api.web3forms.com/submit",
            data=json.dumps(web3_payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"}
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"[WEB3FORMS] Quote notification dispatched to thesparqlane@gmail.com for {clean_name}.")
    except Exception as w3err:
        print(f"[WEB3FORMS] Web3Forms dispatch notification info: {w3err}")

    return {"message": "Your custom quote request has been received! Our team will get back to you within 24 hours."}


# ── Admin Auth ─────────────────────────────────────────────────────────────────

@router.post("/admin/token", response_model=TokenResponse)
def admin_login(data: TokenRequest, request: Request):
    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    current_time = time.time()

    # Clean up older timestamps for this IP
    if ip not in login_attempts:
        login_attempts[ip] = []
    login_attempts[ip] = [t for t in login_attempts[ip] if current_time - t < 60]

    # Check rate limit
    if len(login_attempts[ip]) >= settings.LOGIN_RATE_LIMIT:
        print(f"[SECURITY] Rate limit exceeded for login attempts from IP: {ip} at {datetime.now(timezone.utc)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a minute.",
        )

    # Log the attempt
    print(f"[SECURITY] Login attempt for user '{data.username}' from IP '{ip}' at {datetime.now(timezone.utc)}")

    if data.username != settings.SPARQLANE_ADMIN_USERNAME or data.password != settings.SPARQLANE_ADMIN_PASSWORD:
        login_attempts[ip].append(current_time)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Clear rate limit attempts on successful login
    login_attempts[ip] = []

    token = create_access_token({"sub": data.username})
    return {"access_token": token, "token_type": "bearer"}



# ── Admin Enquiries ────────────────────────────────────────────────────────────

@router.get("/admin/enquiries", response_model=List[EnquiryOut])
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
