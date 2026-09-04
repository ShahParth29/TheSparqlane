import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings


def send_email_notification(
    subject: str,
    body_html: str,
) -> bool:
    """Send an email via Gmail SMTP. Returns True on success, False on failure."""
    settings = get_settings()

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("[EMAIL] SMTP credentials not configured — skipping email.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM or settings.SMTP_USER
    msg["To"] = settings.EMAIL_TO or settings.SMTP_USER

    msg.attach(MIMEText(body_html, "html"))

    try:
        # Use SMTP_SSL for port 465, else standard SMTP
        if settings.SMTP_PORT == 465:
            server_conn = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server_conn = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            
        with server_conn as server:
            if settings.SMTP_PORT != 465 and settings.SMTP_USE_TLS:
                server.ehlo()
                server.starttls()
                server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[EMAIL] Sent: {subject}")
        return True
    except Exception as exc:
        print(f"[EMAIL] Failed to send: {exc}")
        return False


def build_enquiry_email(name: str, email: str, phone: str, project_type: str,
                        budget_range: str, event_date: str, message: str) -> str:
    """Build a styled HTML email for a new client enquiry."""
    return f"""
    <div style="font-family:'Outfit','Inter',Arial,sans-serif;max-width:600px;margin:auto;
                background:#080721;color:#ffffff;border-radius:16px;overflow:hidden;
                box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid rgba(139,92,246,0.2);">
        <div style="background:linear-gradient(135deg,#e5b842,#a87c11);padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎬 New Client Enquiry</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">A potential client has requested details on The Sparqlane</p>
        </div>
        <div style="padding:32px;background:#080721;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;width:140px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Name</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;"><strong>{name}</strong></td>
                </tr>
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Email</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;"><a href="mailto:{email}" style="color:#a78bfa;text-decoration:none;">{email}</a></td>
                </tr>
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Phone</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">{phone or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Project Type</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;"><span style="background:rgba(6,182,212,0.15);color:#06b6d4;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">{project_type}</span></td>
                </tr>
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Budget Range</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">{budget_range}</td>
                </tr>
                <tr>
                    <td style="padding:12px 0;color:#06b6d4;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">Event Date</td>
                    <td style="padding:12px 0;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;">{event_date or 'N/A'}</td>
                </tr>
            </table>
            <div style="margin-top:24px;padding:20px;background:rgba(139,92,246,0.1);border-radius:12px;
                        border-left:4px solid #8b5cf6;">
                <p style="margin:0 0 8px;color:#a78bfa;font-size:12px;text-transform:uppercase;font-weight:bold;letter-spacing:0.5px;">Message Details</p>
                <p style="margin:0;line-height:1.6;color:#f1f5f9;font-size:14px;white-space:pre-wrap;">{message}</p>
            </div>
        </div>
        <div style="background:rgba(255,255,255,0.02);text-align:center;padding:16px;border-top:1px solid rgba(255,255,255,0.05);font-size:12px;color:#64748b;">
            This enquiry was sent automatically from The Sparqlane Portal.
        </div>
    </div>
    """
