from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from datetime import datetime, timedelta, timezone
from app.agent.state import AgentState
from app.agent.schemas import UnderstandQueryResult
from app.agent.prompts import UNDERSTAND_QUERY_PROMPT
from app.config import get_settings


VIETNAM_TIMEZONE = timezone(timedelta(hours=7))


def parse_vietnamese_time_keywords(message: str, current: datetime):
    lowered = message.casefold()
    has_time_kw = False
    date_from = None
    date_to = None

    if "cuối tuần" in lowered:
        has_time_kw = True
        weekday = current.weekday()
        if weekday == 6:  # Sunday
            sat = current - timedelta(days=1)
            sun = current
        else:  # Mon to Sat
            days_to_sat = 5 - weekday
            sat = current + timedelta(days=days_to_sat)
            sun = sat + timedelta(days=1)
        date_from = sat.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_to = sun.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif "hôm nay" in lowered:
        has_time_kw = True
        date_from = current.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_to = current.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif "ngày mai" in lowered:
        has_time_kw = True
        tomorrow = current + timedelta(days=1)
        date_from = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_to = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif "tuần này" in lowered:
        has_time_kw = True
        weekday = current.weekday()
        mon = current - timedelta(days=weekday)
        sun = mon + timedelta(days=6)
        date_from = mon.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_to = sun.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif "tuần tới" in lowered or "tuần sau" in lowered:
        has_time_kw = True
        weekday = current.weekday()
        next_mon = current + timedelta(days=(7 - weekday))
        next_sun = next_mon + timedelta(days=6)
        date_from = next_mon.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_to = next_sun.replace(hour=23, minute=59, second=59, microsecond=0).isoformat()
    elif any(k in lowered for k in ["sắp hết hạn", "sắp tới", "sắp diễn ra"]):
        has_time_kw = True
        date_from = current.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    return date_from, date_to, has_time_kw


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

    d_from, d_to, _ = parse_vietnamese_time_keywords(message, current)
    if d_from and not normalized.get("date_from"):
        normalized["date_from"] = d_from
    if d_to and not normalized.get("date_to"):
        normalized["date_to"] = d_to

    date_from = normalized.get("date_from")
    if isinstance(date_from, str) and len(date_from) == 10:
        normalized["date_from"] = f"{date_from}T00:00:00+07:00"

    date_to = normalized.get("date_to")
    if isinstance(date_to, str) and len(date_to) == 10:
        normalized["date_to"] = f"{date_to}T23:59:59+07:00"

    return normalized


def understand_query_node(state: AgentState):
    settings = get_settings()
    # Using ChatOpenAI as default
    llm_kwargs = {
        "model": settings.model_name,
        "api_key": settings.model_api_key or "dummy",
    }
    if settings.model_base_url:
        llm_kwargs["base_url"] = settings.model_base_url
        
    llm = ChatOpenAI(**llm_kwargs)
    
    messages = [("system", UNDERSTAND_QUERY_PROMPT)]
    raw_history = state.get("history") or []
    for item in raw_history[-4:]:
        role = item.get("role")
        content = item.get("content")
        if role in ["user", "assistant"] and content:
            messages.append((role, content))
    messages.append(("user", "{message}"))

    prompt = ChatPromptTemplate.from_messages(messages)
    
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
        current = datetime.fromisoformat(state["current_date"])
        if current.tzinfo is None:
            current = current.replace(tzinfo=VIETNAM_TIMEZONE)
        _, _, has_time_kw = parse_vietnamese_time_keywords(state["message"], current)
        
        missing_fields = list(result.missing_fields)
        if has_time_kw or state["filters"].get("date_from") or state["filters"].get("date_to"):
            missing_fields = [f for f in missing_fields if f != "date"]
        state["missing_fields"] = missing_fields
        state["confidence"] = result.confidence
    except Exception as e:
        # Fallback or error handling
        state["intent"] = "error"
        state["confidence"] = "low"
        state["missing_fields"] = []
        state["filters"] = {}
        
    return state
