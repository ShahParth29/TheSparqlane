import os
from typing import Optional
from app.core.config import get_settings

settings = get_settings()

class SupabaseBackend:
    """Supabase API client interface for database & auth integration."""
    def __init__(self):
        self.url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL", "")
        self.key = settings.SUPABASE_KEY or os.environ.get("SUPABASE_KEY", "")
        self.service_key = settings.SUPABASE_SERVICE_KEY or os.environ.get("SUPABASE_SERVICE_KEY", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.key)

    def get_headers(self, use_service_role: bool = False) -> dict:
        api_key = self.service_key if (use_service_role and self.service_key) else self.key
        return {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

supabase_backend = SupabaseBackend()
