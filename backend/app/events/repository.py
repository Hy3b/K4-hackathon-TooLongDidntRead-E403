import json
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from app.config import get_settings

class JsonEventRepository:
    def __init__(self):
        self.settings = get_settings()
        self.events = self._load_events()

    def _load_events(self) -> List[Dict[str, Any]]:
        path = self.settings.event_data_path
        if not os.path.exists(path):
            raise FileNotFoundError(f"Event dataset not found: {path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict) or not isinstance(data.get("items"), list):
            raise ValueError("Event dataset must contain an 'items' list")
        return data["items"]

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone(timedelta(hours=7)))
        return parsed.astimezone(timezone.utc)

    def get_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        for event in self.events:
            if event.get("id") == event_id:
                return event
        return None

    def search(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        results = []
        for event in self.events:
            if event.get("status") == "cancelled" and not filters.get("include_cancelled", False):
                continue

            # Apply filters
            if "event_type" in filters and filters["event_type"]:
                if event.get("event_type") != filters["event_type"]:
                    continue
            
            if "cost" in filters and filters["cost"] and filters["cost"] != "any":
                if event.get("cost") != filters["cost"]:
                    continue
            
            if "format" in filters and filters["format"] and filters["format"] != "any":
                if event.get("format") != filters["format"]:
                    continue

            if "organizer" in filters and filters["organizer"]:
                if event.get("organizer") != filters["organizer"]:
                    continue
                    
            if "location" in filters and filters["location"]:
                # Simple substring match
                loc = event.get("location", "").lower()
                if filters["location"].lower() not in loc:
                    continue

            if "topics" in filters and filters["topics"]:
                event_topics = set(event.get("topics", []))
                filter_topics = set(filters["topics"])
                # Require at least one matching topic (intersection)
                if not event_topics.intersection(filter_topics):
                    continue
            
            # Time filters (starts_at)
            # Simplistic string comparison works for ISO-8601 if timezones are the same
            if "date_from" in filters and filters["date_from"]:
                if self._parse_datetime(event["starts_at"]) < self._parse_datetime(filters["date_from"]):
                    continue
            
            if "date_to" in filters and filters["date_to"]:
                if self._parse_datetime(event["starts_at"]) > self._parse_datetime(filters["date_to"]):
                    continue

            results.append(event)
            
        return results
