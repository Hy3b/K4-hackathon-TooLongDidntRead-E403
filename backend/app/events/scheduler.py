import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import logging
from app.events.repository import SqliteEventRepository
from app.database import get_db

logger = logging.getLogger(__name__)

async def check_reminders_task():
    logger.info("Background scheduler for notifications started.")
    while True:
        try:
            repo = SqliteEventRepository()
            now = datetime.now(timezone.utc)
            
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM reminders WHERE notified = 0")
                reminders = cursor.fetchall()
                
                for reminder in reminders:
                    reminder_dict = dict(reminder)
                    event = repo.get_by_id(reminder_dict["event_id"])
                    if not event:
                        continue
                        
                    event_starts_at = repo._parse_datetime(event["starts_at"])
                    time_left = event_starts_at - now
                    
                    if timedelta(0) < time_left <= timedelta(hours=24):
                        notice_id = str(uuid.uuid4())
                        title = f"Nhắc lịch: {reminder_dict.get('event_title', 'Sự kiện')}"
                        text = f"Sự kiện sẽ diễn ra vào {event_starts_at.strftime('%H:%M %d/%m/%Y')}. Hãy chuẩn bị nhé!"
                        created_at = now.isoformat()
                        
                        cursor.execute('''
                            INSERT INTO notifications (id, icon, tone, title, text, time, category, is_read, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (notice_id, "✓", "green", title, text, "Vừa xong", "Nhắc lịch", False, created_at))
                        
                        cursor.execute("UPDATE reminders SET notified = 1 WHERE id = ?", (reminder_dict["id"],))
                
                conn.commit()
                
        except Exception as e:
            logger.error(f"Error in scheduler: {e}")
            
        await asyncio.sleep(10) # Chạy mỗi 10 giây
