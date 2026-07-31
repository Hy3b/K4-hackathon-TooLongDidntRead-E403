import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from app.database import get_db

class SqliteEventRepository:
    def __init__(self):
        pass

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone(timedelta(hours=7)))
        return parsed.astimezone(timezone.utc)
        
    def _row_to_dict(self, row) -> Dict[str, Any]:
        d = dict(row)
        d["is_mock"] = bool(d["is_mock"])
        d["topics"] = json.loads(d["topics"]) if d.get("topics") else []
        d["conflicts"] = json.loads(d["conflicts"]) if d.get("conflicts") else []
        return d

    def get_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_dict(row)
        return None

    def search(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        query = "SELECT * FROM events WHERE 1=1"
        params = []
        
        if not filters.get("include_cancelled", False):
            query += " AND status != 'cancelled'"
            
        if filters.get("event_type"):
            query += " AND event_type = ?"
            params.append(filters["event_type"])
            
        if filters.get("cost") and filters["cost"] != "any":
            query += " AND cost = ?"
            params.append(filters["cost"])
            
        if filters.get("format") and filters["format"] != "any":
            query += " AND format = ?"
            params.append(filters["format"])
            
        if filters.get("organizer"):
            query += " AND organizer = ?"
            params.append(filters["organizer"])
            
        if filters.get("location"):
            query += " AND LOWER(location) LIKE ?"
            params.append(f"%{filters['location'].lower()}%")
            
        # Time filters: we can use simple string comparison for ISO8601
        if filters.get("date_from"):
            query += " AND starts_at >= ?"
            params.append(filters["date_from"])
            
        if filters.get("date_to"):
            query += " AND starts_at <= ?"
            params.append(filters["date_to"])

        results = []
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            for row in rows:
                event = self._row_to_dict(row)
                
                # Check topics (since they are stored as JSON strings, we need to filter them in Python or use SQLite JSON1)
                # Filtering in Python is easier and completely fine for this scale
                if filters.get("topics"):
                    event_topics = set(event.get("topics", []))
                    filter_topics = set(filters["topics"])
                    if not event_topics.intersection(filter_topics):
                        continue
                
                results.append(event)
                
        return results

# Tương thích ngược với các file import JsonEventRepository
JsonEventRepository = SqliteEventRepository
