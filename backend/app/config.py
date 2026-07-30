from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    model_api_key: str = ""
    model_name: str = "gpt-4o-mini"
    model_base_url: str = "" # Optional base URL for local LLMs
    model_provider: Literal["openai"] = "openai"  # OpenAI or an OpenAI-compatible endpoint
    prompt_version: str = "cp3-v1"
    frontend_origin: str = "http://localhost:3000"
    event_data_path: str = "./data/events.json"
    trace_dir: str = "./eval/results/traces"
    trace_max_files: int = 500

@lru_cache()
def get_settings():
    return Settings()
