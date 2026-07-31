from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage
from datetime import datetime, timedelta, timezone
from app.agent.state import AgentState
from app.agent.schemas import UnderstandQueryResult
from app.agent.prompts import UNDERSTAND_QUERY_PROMPT
from app.config import get_settings


VIETNAM_TIMEZONE = timezone(timedelta(hours=7))


def normalize_filters(filters: dict, message: str, current_date: str) -> dict:
    normalized = dict(filters)
    lowered_message = message.casefold()
    current = datetime.fromisoformat(current_date)
    if current.tzinfo is None:
        current = current.replace(tzinfo=VIETNAM_TIMEZONE)

    if "online" in lowered_message or "trực tuyến" in lowered_message:
        normalized["format"] = "online"
        if str(normalized.get("location", "")).casefold() in {"online", "trực tuyến"}:
            normalized.pop("location", None)

    if "hôm nay" in lowered_message:
        normalized["date_from"] = current.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    date_from = normalized.get("date_from")
    if isinstance(date_from, str) and len(date_from) == 10:
        normalized["date_from"] = f"{date_from}T00:00:00+07:00"

    date_to = normalized.get("date_to")
    if isinstance(date_to, str) and len(date_to) == 10:
        normalized["date_to"] = f"{date_to}T23:59:59+07:00"

    return normalized


def fallback_search_intent(message: str, current_date: str) -> dict:
    """Extract coarse filters locally when the model gateway is unavailable."""
    lowered = message.casefold()
    current = datetime.fromisoformat(current_date)
    if current.tzinfo is None:
        current = current.replace(tzinfo=VIETNAM_TIMEZONE)
    filters: dict = {}
    if any(term in lowered for term in ("mi\u1ec5n ph\u00ed", "free", "kh\u00f4ng m\u1ea5t ph\u00ed")):
        filters["cost"] = "free"
    if any(term in lowered for term in ("online", "tr\u1ef1c tuy\u1ebfn")):
        filters["format"] = "online"
    if "h\u00f4m nay" in lowered:
        filters["date_from"] = current.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        filters["date_to"] = current.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif any(term in lowered for term in ("s\u1eafp t\u1edbi", "g\u1ea7n \u0111\u00e2y", "s\u1eafp di\u1ec5n ra", "tu\u1ea7n n\u00e0y")):
        filters["date_from"] = current.isoformat()
        filters["date_to"] = (current + timedelta(days=30)).isoformat()
    else:
        return {}
    return filters


def understand_query_node(state: AgentState):
    message = state.get("message", "").strip().lower()
    
    # Bỏ qua LLM nếu là câu hỏi thông thường
    if message in ["xin chào", "hello", "hi", "chào bạn", "chào", "chào cậu", "chào anh", "chào chị", "alo", "ê"]:
        state["intent"] = "greeting"
        state["direct_answer"] = "Xin chào! Mình có thể giúp bạn tìm các sự kiện của trường theo thời gian, chủ đề, hình thức và địa điểm."
        state["confidence"] = "high"
        state["missing_fields"] = []
        state["filters"] = {}
        return state
        
    cap_keywords = ["bạn làm được gì", "chức năng của bạn", "khả năng của bạn", "help", "giúp đỡ", "bạn là ai", "mày là ai", "cậu là ai", "bạn tên gì", "tên bạn là gì", "làm được gì", "giúp gì", "bạn có thể làm gì", "hướng dẫn", "cách dùng"]
    if message in cap_keywords or any(k in message for k in ["bạn là ai", "bạn làm được gì", "chức năng của bạn", "khả năng của bạn"]):
        state["intent"] = "capabilities"
        state["direct_answer"] = "Mình giúp tìm kiếm sự kiện trong dữ liệu của trường theo thời gian, chủ đề, loại, chi phí, hình thức và địa điểm."
        state["confidence"] = "high"
        state["missing_fields"] = []
        state["filters"] = {}
        return state

    settings = get_settings()
    # Using ChatOpenAI as default
    llm_kwargs = {
        "model": settings.model_name,
        "api_key": settings.model_api_key or "dummy",
        "timeout": settings.model_timeout_seconds,
        "max_retries": settings.model_max_retries,
    }
    if settings.model_base_url:
        llm_kwargs["base_url"] = settings.model_base_url
        
    llm = ChatOpenAI(**llm_kwargs)
    
    history_messages = []
    for msg in state.get("history", []):
        if msg.get("role") == "user":
            history_messages.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            history_messages.append(AIMessage(content=msg.get("content", "")))
            
    prompt = ChatPromptTemplate.from_messages([
        ("system", UNDERSTAND_QUERY_PROMPT),
        *history_messages,
        ("user", "{message}")
    ])
    
    llm_with_tools = llm.bind_tools([UnderstandQueryResult])
    chain = prompt | llm_with_tools
    
    try:
        msg = chain.invoke({"message": state["message"], "current_date": state["current_date"]})
        
        if not msg.tool_calls:
            raise ValueError("No tool calls returned")
            
        result = UnderstandQueryResult(**msg.tool_calls[0]["args"])
        
        # update state
        state["intent"] = result.intent
        raw_filters = result.filters.model_dump(exclude_none=True) if result.filters else {}
        state["filters"] = normalize_filters(
            raw_filters,
            state["message"],
            state["current_date"],
        )
        state["missing_fields"] = result.missing_fields
        state["confidence"] = result.confidence
        state["direct_answer"] = result.direct_answer
        state["error_code"] = None
    except Exception:
        fallback_filters = fallback_search_intent(state["message"], state["current_date"])
        if fallback_filters:
            state["intent"] = "search_events"
            state["error_code"] = None
            state["confidence"] = "low"
            state["missing_fields"] = []
            state["filters"] = fallback_filters
            state["warnings"] = state.get("warnings", []) + [
                "AI đang tạm thời không khả dụng; hệ thống dùng bộ lọc cơ bản để tìm sự kiện."
            ]
            return state
        state["intent"] = "error"
        state["error_code"] = "UNDERSTAND_QUERY_FAILED"
        state["direct_answer"] = "Mình chưa thể hiểu câu hỏi lúc này. Vui lòng thử lại với thời gian hoặc chủ đề cụ thể hơn."
        state["confidence"] = "low"
        state["missing_fields"] = []
        state["filters"] = {}
        
    return state
