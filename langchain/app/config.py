"""
Application configuration — single source of truth for all environment variables.
"""

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Google Gemini ────────────────────────────────────────────────────────
    google_api_key: str
    gemini_model: str
    gemini_embed_model: str

    # ── Qdrant ────────────────────────────────────────────────────────────────
    qdrant_url: str

    # ── FastAPI / CORS ────────────────────────────────────────────────────────
    # Stored as a plain string to avoid pydantic-settings trying to JSON-decode
    # a comma-separated value (which raises JSONDecodeError).
    host: str
    port: int
    allowed_origins_str: str

    @computed_field  # type: ignore[misc]
    @property
    def allowed_origins(self) -> list[str]:
        """Return CORS origins as a list, parsing either CSV or JSON array."""
        v = self.allowed_origins_str.strip()
        if v.startswith("["):
            import json

            return json.loads(v)
        return [o.strip() for o in v.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


_settings: "Settings | None" = None


def get_settings() -> "Settings":
    """
    Return the Settings singleton for this process.
    Initialised once at first call — reset naturally when uvicorn spawns
    a new worker process after a hot-reload.
    """
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
    return _settings
