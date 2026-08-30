from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


# ── Video ──────────────────────────────────────────────────────────────────────

_ALLOWED_VIDEO_CATEGORIES = {
    "cinematic", "commercial", "short-film", "car-delivery",
    "influencer", "social-media", "event", "wedding", "other",
}


class VideoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    youtube_url: Optional[str] = Field(None, max_length=500)
    video_file_url: Optional[str] = Field(None, max_length=1000)
    thumbnail_url: Optional[str] = Field(None, max_length=1000)
    category: str = Field("cinematic", min_length=1, max_length=60)
    description: str = Field("", max_length=2000)
    is_featured: bool = False
    sort_order: int = Field(0, ge=0, le=9999)

    @field_validator("youtube_url")
    @classmethod
    def validate_youtube_url(cls, v: Optional[str]) -> Optional[str]:
        if v and v.strip():
            if not re.match(r"^https?://(www\.)?(youtube\.com|youtu\.be)/", v):
                raise ValueError("youtube_url must be a valid YouTube URL")
        return v


class VideoCreate(VideoBase):
    pass


class VideoUpdate(VideoBase):
    pass


class VideoOut(VideoBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Client Enquiry ─────────────────────────────────────────────────────────────

_PHONE_PATTERN = re.compile(r"^\+?[\d\s\-\(\)]{7,20}$")


class EnquiryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field("", max_length=25)
    project_type: str = Field(..., min_length=1, max_length=200)
    budget_range: str = Field("", max_length=50)
    event_date: str = Field("", max_length=50)
    message: str = Field(..., min_length=10, max_length=5000)
    website: Optional[str] = Field(None, max_length=200)  # Honeypot

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if v and v.strip() and not _PHONE_PATTERN.match(v.strip()):
            raise ValueError("phone must be a valid phone number (7–20 digits)")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        # Reject names that look like HTML/script injection
        if re.search(r"[<>\"'`]", v):
            raise ValueError("name contains invalid characters")
        return v.strip()

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if re.search(r"<script", v, re.IGNORECASE):
            raise ValueError("message contains invalid content")
        return v.strip()


class EnquiryOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    project_type: str
    budget_range: str
    event_date: str
    message: str
    is_read: bool
    received_at: datetime

    class Config:
        from_attributes = True


# ── Blog ───────────────────────────────────────────────────────────────────────

_SLUG_PATTERN = re.compile(r"^[a-z0-9\-]+$")


class BlogPostBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    slug: str = Field(..., min_length=1, max_length=150)
    content: str = Field("", max_length=100_000)
    cover_image_url: str = Field("", max_length=1000)
    category: str = Field("tips", min_length=1, max_length=60)
    is_published: bool = False

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not _SLUG_PATTERN.match(v):
            raise ValueError("slug must contain only lowercase letters, numbers, and hyphens")
        return v


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = Field(None, min_length=1, max_length=150)
    content: Optional[str] = Field(None, max_length=100_000)
    cover_image_url: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, min_length=1, max_length=60)
    is_published: Optional[bool] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _SLUG_PATTERN.match(v):
            raise ValueError("slug must contain only lowercase letters, numbers, and hyphens")
        return v


class BlogPostOut(BlogPostBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Pricing ────────────────────────────────────────────────────────────────────

class PricingPlanBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    price: float = Field(..., ge=0, le=10_000_000)
    original_price: Optional[float] = Field(None, ge=0, le=10_000_000)
    features: str = Field("", max_length=2000)
    is_popular: bool = False
    is_active: bool = True


class PricingPlanCreate(PricingPlanBase):
    pass


class PricingPlanUpdate(PricingPlanBase):
    pass


class PricingPlanOut(PricingPlanBase):
    id: int

    class Config:
        from_attributes = True


# ── Site Settings ──────────────────────────────────────────────────────────────

class SiteSettingsOut(BaseModel):
    """All site settings as a flat dict."""
    settings: Dict[str, str]


class SiteSettingsUpdate(BaseModel):
    """Partial update — only send keys you want to change."""
    settings: Dict[str, str] = Field(..., max_length=50)  # max 50 keys per update

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, v: Dict[str, str]) -> Dict[str, str]:
        if len(v) > 50:
            raise ValueError("Too many settings keys in a single update (max 50)")
        for key, val in v.items():
            if len(key) > 100:
                raise ValueError(f"Setting key '{key[:20]}...' is too long (max 100 chars)")
            if len(val) > 5000:
                raise ValueError(f"Setting value for '{key}' is too long (max 5000 chars)")
        return v


# ── Auth ───────────────────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Generic ────────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
