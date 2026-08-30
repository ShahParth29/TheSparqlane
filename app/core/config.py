from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./portfolio.db"
    SECRET_KEY: str = "INSECURE-DEV-KEY-CHANGE-IN-PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    SPARQLANE_ADMIN_USERNAME: str = "PNG"
    SPARQLANE_ADMIN_PASSWORD: str = "PNG@SPARQLANE"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = ""
    EMAIL_TO: str = "thesparqlane@gmail.com"
    WEB3FORMS_KEY: str = ""
    UPLOAD_DIR: str = "frontend/uploads"

    # Storage backend: "local", "cloudinary", or "s3"
    STORAGE_BACKEND: str = "local"

    # Cloudinary (required when STORAGE_BACKEND=cloudinary)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # S3 / Cloudflare R2 / Backblaze B2 (required when STORAGE_BACKEND=s3)
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = ""
    S3_ENDPOINT_URL: str = ""
    S3_REGION_NAME: str = ""
    S3_PUBLIC_URL: str = ""

    # Security
    CORS_ORIGINS: str = "*"  # Comma-separated origins for production

    # ── Rate limiting (all values are configurable via env vars) ────────────
    # Auth route limits
    LOGIN_RATE_LIMIT: int = 5           # max consecutive failures before first lockout
    LOGIN_RATE_WINDOW_SECONDS: int = 60  # sliding window for counting failures
    LOGIN_BACKOFF_BASE_SECONDS: int = 30 # base lockout duration; doubles each tier (30s→2m→8m→30m)
    LOGIN_MAX_LOCKOUT_SECONDS: int = 1800  # cap at 30 minutes

    # Public enquiry route limits
    ENQUIRY_RATE_LIMIT: int = 5
    ENQUIRY_RATE_WINDOW_SECONDS: int = 600  # 10 minutes

    # ── File upload size limits ─────────────────────────────────────────────
    MAX_VIDEO_SIZE_MB: int = 200
    MAX_IMAGE_SIZE_MB: int = 10

    # Supabase Backend Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    ADMIN_USERNAME: str = ""
    ADMIN_PASSWORD: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
