from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
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
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", UNDERSTAND_QUERY_PROMPT),
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
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Fallback or error handling
        state["intent"] = "error"
        state["confidence"] = "low"
        state["missing_fields"] = []
        state["filters"] = {}
        
    return state
