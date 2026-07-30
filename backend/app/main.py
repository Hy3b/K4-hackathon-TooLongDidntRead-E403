from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.config import get_settings
from app.events.repository import JsonEventRepository
import json

app = FastAPI(title="CP3 Event Assistant API")

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/ready")
async def ready_check():
    try:
        JsonEventRepository()
        data_ok = True
    except (OSError, ValueError, json.JSONDecodeError):
        data_ok = False
    key_ok = settings.model_api_key not in {"", "dummy", "replace-me"}
    
    if data_ok and key_ok:
        return {"status": "ready"}
    
    return JSONResponse(
        status_code=503,
        content={
            "status": "not_ready",
            "details": {"data_readable": data_ok, "key_configured": key_ok},
        },
    )
