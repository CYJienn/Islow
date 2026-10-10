from functools import lru_cache
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)
    default_research_mode: str = "demo"
    sentiment_model_path: Path = Path("ml/model/growthlab-sentiment-yelp-tuned")
    sentiment_model_source: Literal["hub", "local"] = "hub"
    sentiment_model_id: str = "KaiHuang05/growthlab-sentiment-yelp-tuned"
    hf_token: str = ""
    tavily_api_key: str = ""
    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    marketing_api_token: str = ""
    max_reviews: int = 200
    max_search_queries: int = 3
    max_search_results: int = 5
    llm_timeout_seconds: int = 45


@lru_cache
def get_settings() -> Settings:
    return Settings()
