from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta, timezone
import asyncio
import json
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


def stream_display_text(response: ChatResponse) -> str:
    if response.clarifying_question:
        return response.clarifying_question
    if response.events:
        count = len(response.events)
        return (
            f"Mình tìm thấy {count} sự kiện phù hợp. "
            "Bạn có thể xem thời gian, địa điểm và hạn đăng ký trong các thẻ bên dưới."
        )
    return response.answer or "Mình chưa có câu trả lời phù hợp."

def save_trace_and_create_response(initial_state: dict, final_state: dict, start_time: float) -> ChatResponse:
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
        
    latency_ms = int((time.time() - start_time) * 1000)
    trace_data = {
        "trace_id": final_state.get("trace_id"),
        "conversation_id": initial_state.get("conversation_id"),
        "input": initial_state.get("message"),
        "current_date": initial_state.get("current_date"),
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
    save_trace_best_effort(trace_data)
    
    return ChatResponse(
        conversation_id=initial_state.get("conversation_id"),
        trace_id=final_state.get("trace_id"),
        answer=answer,
        intent=intent,
        confidence=confidence,
        clarifying_question=clarifying_question,
        events=events[:3],
        warnings=warnings,
        suggested_actions=suggested_actions,
        filters=filters,
        tool_called=tool_called,
    )

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    start_time = time.time()
    
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
        final_state = await run_in_threadpool(agent_app.invoke, initial_state)
        response = await run_in_threadpool(save_trace_and_create_response, initial_state, final_state, start_time)
        return response
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        await run_in_threadpool(save_trace_best_effort, {
            "trace_id": trace_id,
            "conversation_id": request.conversation_id,
            "input": request.message,
            "error": str(e),
            "latency_ms": latency_ms
        })
        return ChatResponse(
            conversation_id=request.conversation_id,
            trace_id=trace_id,
            answer="Hệ thống đang bận hoặc gặp lỗi. Vui lòng thử lại sau.",
            intent="error",
            confidence="low",
            filters={},
            tool_called=False,
        )

@router.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    async def generate():
        start_time = time.time()
        
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
        
        final_state = dict(initial_state)
        node_start_time = time.time()
        
        try:
            async for step in agent_app.astream(initial_state, stream_mode="updates"):
                for node_name, node_update in step.items():
                    final_state.update(node_update)
                    duration_ms = int((time.time() - node_start_time) * 1000)
                    
                    if node_name == "understand_query":
                        intent = node_update.get("intent")
                        missing = node_update.get("missing_fields", [])
                        yield json.dumps({
                            "type": "activity",
                            "data": {
                                "id": f"act_{uuid4().hex[:8]}",
                                "title": "Phân tích yêu cầu",
                                "details": f"Ý định: {intent}. {('Còn thiếu ' + ', '.join(missing)) if missing else 'Đủ thông tin.'}",
                                "duration": duration_ms,
                                "status": "success"
                            }
                        }, ensure_ascii=False) + "\n"
                        
                    elif node_name == "search_events":
                        # search tool call
                        output_summary = f"Tìm thấy {len(node_update.get('search_results', []))} kết quả."
                        yield json.dumps({
                            "type": "tool_call",
                            "data": {
                                "id": f"tool_{uuid4().hex[:8]}",
                                "name": "search_events",
                                "input": final_state.get("filters", {}),
                                "output": output_summary,
                                "duration": duration_ms,
                                "status": "success"
                            }
                        }, ensure_ascii=False) + "\n"
                        
                    elif node_name == "validate_results":
                        warnings = node_update.get("warnings", [])
                        if warnings:
                            yield json.dumps({
                                "type": "activity",
                                "data": {
                                    "id": f"act_{uuid4().hex[:8]}",
                                    "title": "Xác thực dữ liệu",
                                    "details": f"Cảnh báo: {', '.join(warnings)}",
                                    "duration": duration_ms,
                                    "status": "success"
                                }
                            }, ensure_ascii=False) + "\n"
                            
                    elif node_name == "out_of_scope":
                         yield json.dumps({
                            "type": "activity",
                            "data": {
                                "id": f"act_{uuid4().hex[:8]}",
                                "title": "Ngoài phạm vi",
                                "details": "Câu hỏi không liên quan đến sự kiện.",
                                "duration": duration_ms,
                                "status": "success"
                            }
                        }, ensure_ascii=False) + "\n"
                        
                    node_start_time = time.time()
                    
            response = await run_in_threadpool(save_trace_and_create_response, initial_state, final_state, start_time)
            
            text = stream_display_text(response)
            words = text.split(" ")
            for index, word in enumerate(words):
                chunk = word if index == 0 else f" {word}"
                yield json.dumps(
                    {"type": "delta", "text": chunk},
                    ensure_ascii=False,
                ) + "\n"
                await asyncio.sleep(0.018)
                
            yield json.dumps(
                {
                    "type": "done",
                    "data": response.model_dump(),
                },
                ensure_ascii=False,
            ) + "\n"
            
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            await run_in_threadpool(save_trace_best_effort, {
                "trace_id": trace_id,
                "conversation_id": request.conversation_id,
                "input": request.message,
                "error": str(e),
                "latency_ms": latency_ms
            })
            yield json.dumps(
                {"type": "delta", "text": "Hệ thống đang bận hoặc gặp lỗi. Vui lòng thử lại sau."},
                ensure_ascii=False,
            ) + "\n"
            error_response = ChatResponse(
                conversation_id=request.conversation_id,
                trace_id=trace_id,
                answer="Hệ thống đang bận hoặc gặp lỗi. Vui lòng thử lại sau.",
                intent="error",
                confidence="low",
            )
            yield json.dumps(
                {"type": "done", "data": error_response.model_dump()},
                ensure_ascii=False,
            ) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
