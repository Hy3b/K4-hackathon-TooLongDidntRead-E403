from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from datetime import datetime, timedelta, timezone
import logging
import time
from uuid import uuid4
from app.agent.graph import agent_app
from app.observability.trace_store import trace_store
from app.config import get_settings

router = APIRouter()
settings = get_settings()
VIETNAM_TIMEZONE = timezone(timedelta(hours=7))
logger = logging.getLogger(__name__)


def save_trace_best_effort(trace_data: dict[str, Any]) -> None:
    try:
        trace_store.save_trace(trace_data)
    except OSError:
        logger.exception("Failed to persist request trace")

class ChatRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=2000)
    current_date: Optional[datetime] = None

class ChatResponse(BaseModel):
    conversation_id: str
    trace_id: str
    answer: Optional[str] = None
    intent: str
    confidence: str
    clarifying_question: Optional[str] = None
    events: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    filters: Dict[str, Any] = Field(default_factory=dict)
    tool_called: bool = False

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    start_time = time.time()
    
    # Initialize state
    current_date = (
        request.current_date.isoformat()
        if request.current_date
        else datetime.now(VIETNAM_TIMEZONE).isoformat()
    )
    trace_id = f"run_{uuid4().hex}"
    
    initial_state = {
        "conversation_id": request.conversation_id,
        "message": request.message,
        "current_date": current_date,
        "trace_id": trace_id,
        "warnings": [],
        "missing_fields": [],
        "search_results": [],
        "suggested_actions": []
    }
    
    try:
        # Run agent
        final_state = await run_in_threadpool(agent_app.invoke, initial_state)
        
        # Prepare response
        answer = final_state.get("answer")
        intent = final_state.get("intent", "unknown")
        confidence = final_state.get("confidence", "low")
        events = final_state.get("search_results", [])
        warnings = final_state.get("warnings", [])
        suggested_actions = final_state.get("suggested_actions", [])
        missing = final_state.get("missing_fields", [])
        filters = final_state.get("filters", {})
        tool_called = intent == "search_events" and not missing
        
        clarifying_question = None
        if intent == "search_events" and missing:
            clarifying_question = answer
            answer = None
            
        # Save trace
        latency_ms = int((time.time() - start_time) * 1000)
        trace_data = {
            "trace_id": trace_id,
            "conversation_id": request.conversation_id,
            "input": request.message,
            "current_date": current_date,
            "intent": intent,
            "filters": filters,
            "tool": "search_events" if tool_called else None,
            "tool_result_count": len(events) if events else 0,
            "events": events[:3],
            "result_status": "success",
            "latency_ms": latency_ms,
            "model": settings.model_name,
            "model_provider": settings.model_provider,
            "prompt_version": settings.prompt_version,
            "warnings": warnings,
            "answer": answer or clarifying_question
        }
        await run_in_threadpool(save_trace_best_effort, trace_data)
        
        return ChatResponse(
            conversation_id=request.conversation_id,
            trace_id=trace_id,
            answer=answer,
            intent=intent,
            confidence=confidence,
            clarifying_question=clarifying_question,
            events=events[:3], # return top 3
            warnings=warnings,
            suggested_actions=suggested_actions,
            filters=filters,
            tool_called=tool_called,
        )
        
    except Exception as e:
        # Save error trace
        latency_ms = int((time.time() - start_time) * 1000)
        await run_in_threadpool(save_trace_best_effort, {
            "trace_id": trace_id,
            "conversation_id": request.conversation_id,
            "input": request.message,
            "error": str(e),
            "latency_ms": latency_ms
        })
        
        # Return fallback response
        return ChatResponse(
            conversation_id=request.conversation_id,
            trace_id=trace_id,
            answer="Hệ thống đang bận hoặc gặp lỗi. Vui lòng thử lại sau.",
            intent="error",
            confidence="low",
            filters={},
            tool_called=False,
        )
