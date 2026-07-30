from typing import TypedDict, Optional, List, Dict, Any
from app.agent.schemas import EventFilter

class AgentState(TypedDict):
    conversation_id: str
    message: str
    current_date: str
    intent: Optional[str]
    filters: Optional[Dict[str, Any]]
    missing_fields: List[str]
    search_results: List[Dict[str, Any]]
    conflicts: List[Dict[str, Any]]
    confidence: str
    answer: Optional[str]
    suggested_actions: List[str]
    trace_id: str
    warnings: List[str]
