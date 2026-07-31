from typing import Optional, Dict, Any
from app.events.repository import JsonEventRepository

def execute_get_event_detail(event_id: str) -> Optional[Dict[str, Any]]:
    """
    Tra cứu chi tiết một sự kiện theo event_id.
    """
    repo = JsonEventRepository()
    return repo.get_by_id(event_id)
