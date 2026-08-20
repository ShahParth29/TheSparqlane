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
    WEB3FORMS_KEY: str = "f4d7d2c8-96d7-483b-8f12-9949a4fee7cd"
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
    LOGIN_RATE_LIMIT: int = 5  # Max login attempts per minute per IP

    # Supabase Backend Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
