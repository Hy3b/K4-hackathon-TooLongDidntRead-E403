from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class EventFilter(BaseModel):
    date_from: Optional[str] = Field(None, description="ISO-8601 date string for the start of the search period")
    date_to: Optional[str] = Field(None, description="ISO-8601 date string for the end of the search period")
    topics: List[str] = Field(default_factory=list, description="List of topics. e.g., 'technology', 'career', 'community', 'learning', 'skills'")
    event_type: Optional[str] = Field(None, description="Type of event, e.g., 'workshop', 'talkshow', 'webinar'")
    cost: Optional[str] = Field("any", description="'free', 'paid', or 'any'")
    format: Optional[str] = Field("any", description="'online', 'offline', or 'any'")
    location: Optional[str] = Field(None, description="Location of the event, e.g., 'Đà Nẵng', 'Hội trường'")
    organizer: Optional[str] = Field(None, description="Organizer of the event, e.g., 'Phòng CTSV'")
    include_cancelled: bool = Field(
        False,
        description="True only when the user explicitly asks about a specific named event that may be cancelled",
    )

class UnderstandQueryResult(BaseModel):
    intent: str = Field(description="'search_events', 'register_event', or 'unknown'")
    filters: Optional[EventFilter] = Field(None, description="Extracted filters for searching events. Leave empty if intent is not search_events")
    missing_fields: List[str] = Field(default_factory=list, description="Required fields that are missing, e.g., ['date']")
    confidence: str = Field(description="'high', 'medium', or 'low'")
    
class AgentResponse(BaseModel):
    answer: str = Field(description="The response message to the user.")
    suggested_actions: List[str] = Field(default_factory=list, description="Suggested next actions for the user, e.g., ['view_detail', 'create_reminder']")
