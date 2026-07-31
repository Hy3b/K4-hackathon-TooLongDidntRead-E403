import os
import json
import sys

# Ensure the app module can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.database import init_db, get_db

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")
EVENTS_JSON_PATH = os.path.join(DATA_DIR, "events.json")
REMINDERS_JSON_PATH = os.path.join(DATA_DIR, "reminders.json")
NOTIFICATIONS_JSON_PATH = os.path.join(DATA_DIR, "notifications.json")

def migrate_events():
    if not os.path.exists(EVENTS_JSON_PATH):
        print(f"Events JSON not found at {EVENTS_JSON_PATH}")
        return

    with open(EVENTS_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    items = data.get("items", [])
    
    with get_db() as conn:
        cursor = conn.cursor()
        for item in items:
            cursor.execute('''
                INSERT OR REPLACE INTO events (
                    id, is_mock, title, description, topics, event_type, format, cost, 
                    starts_at, ends_at, registration_deadline, location, organizer, status, source_url, updated_at, conflicts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item.get("id"),
                item.get("is_mock"),
                item.get("title"),
                item.get("description"),
                json.dumps(item.get("topics", []), ensure_ascii=False),
                item.get("event_type"),
                item.get("format"),
                item.get("cost"),
                item.get("starts_at"),
                item.get("ends_at"),
                item.get("registration_deadline"),
                item.get("location"),
                item.get("organizer"),
                item.get("status"),
                item.get("source_url"),
                item.get("updated_at"),
                json.dumps(item.get("conflicts", []), ensure_ascii=False)
            ))
        conn.commit()
    print(f"Migrated {len(items)} events to SQLite.")

def run_migration():
    print("Initializing database...")
    init_db()
    print("Migrating events...")
    migrate_events()
    print("Migration complete.")

if __name__ == "__main__":
    run_migration()
