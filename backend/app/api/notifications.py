import json
import os
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone
from app.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])
reminders_router = APIRouter(prefix="/reminders", tags=["reminders"])

class ReminderRequest(BaseModel):
    event_id: str
    event_title: str

@reminders_router.post("")
def create_reminder(req: ReminderRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        # Check if already exists
        cursor.execute("SELECT 1 FROM reminders WHERE event_id = ?", (req.event_id,))
        if cursor.fetchone():
            return {"status": "ok", "message": "Reminder already exists"}
            
        cursor.execute('''
            INSERT INTO reminders (event_id, event_title, created_at, notified)
            VALUES (?, ?, ?, 0)
        ''', (req.event_id, req.event_title, datetime.now(timezone.utc).isoformat()))
        
        # Thêm thông báo ngay lập tức vào tab Thông báo
        cursor.execute('''
            INSERT INTO notifications (id, icon, tone, title, text, time, category, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ''', (
            str(uuid.uuid4()),
            "✅",
            "success",
            "Đã thêm vào lịch",
            f"Bạn đã tạo lời nhắc cho sự kiện: {req.event_title}. Hệ thống sẽ báo lại trước 24 giờ.",
            "Vừa xong",
            "Nhắc lịch",
            datetime.now(timezone.utc).isoformat()
        ))
        
        conn.commit()
        
    return {"status": "ok"}

@reminders_router.get("")
def get_reminders():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*, e.starts_at, e.location as place, e.organizer, e.event_type as category, e.status 
            FROM reminders r 
            LEFT JOIN events e ON r.event_id = e.id
            ORDER BY r.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

@router.get("")
def get_notifications():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notifications ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]

@router.post("/read")
def mark_read():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE is_read = 0")
        conn.commit()
    return {"status": "ok"}
