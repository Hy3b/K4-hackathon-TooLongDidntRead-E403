from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat import router as chat_router
from app.config import get_settings
from app.events.repository import SqliteEventRepository
from app.api.notifications import router as notifications_router, reminders_router
from app.api.history import router as history_router
from app.events.scheduler import check_reminders_task
from app.database import init_db, get_db
import asyncio
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo DB
    init_db()
    # Khởi chạy background task khi app start
    task = asyncio.create_task(check_reminders_task())
    yield
    task.cancel()

app = FastAPI(title="CP3 Event Assistant API", lifespan=lifespan)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(reminders_router, prefix="/api")
app.include_router(history_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/ready")
async def ready_check():
    try:
        with get_db() as conn:
            conn.execute("SELECT 1 FROM events LIMIT 1")
        data_ok = True
    except Exception:
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
