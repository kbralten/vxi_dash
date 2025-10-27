from functools import lru_cache
from typing import Optional

from pydantic import AnyUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "VXI-11 Dashboard API"
    api_prefix: str = "/api"
    database_url: str = "sqlite+aiosqlite:///./vxi_dash.db"
    instrument_mock_url: Optional[AnyUrl] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
