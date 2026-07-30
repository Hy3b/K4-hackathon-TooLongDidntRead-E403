from typing import Dict, Any
from app.events.service import search_events as service_search_events

def execute_search(filters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Wrapper around the search_events service to be used as a tool in LangGraph if needed.
    """
    return service_search_events(filters)
