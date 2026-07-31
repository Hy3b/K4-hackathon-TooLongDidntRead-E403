from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.nodes.understand_query import understand_query_node
from app.agent.nodes.validate_results import validate_results_node
from app.agent.nodes.compose_response import compose_response_node
from app.agent.tools.search_events import execute_search

def ask_clarification_node(state: AgentState):
    missing = state.get("missing_fields", [])
    if "date" in missing:
        state["answer"] = "Bạn muốn tìm sự kiện trong hôm nay, cuối tuần này hay khoảng thời gian nào?"
    elif "topic" in missing:
        state["answer"] = "Bạn quan tâm đến chủ đề nào? (ví dụ: công nghệ, kỹ năng, việc làm...)"
    else:
        state["answer"] = "Bạn có thể cung cấp thêm thông tin về thời gian hoặc chủ đề sự kiện được không?"
    return state

def search_events_node(state: AgentState):
    filters = state.get("filters", {})
    try:
        tool_result = execute_search(filters)
        state["search_results"] = tool_result.get("items", [])
    except Exception as e:
        state["search_results"] = []
        state["error_code"] = "SEARCH_TOOL_FAILED"
        state["warnings"] = state.get("warnings", []) + ["Lỗi khi gọi tool tìm kiếm."]
    return state

def direct_answer_node(state: AgentState):
    state["answer"] = state.get("direct_answer") or "Xin lỗi, mình chưa hiểu ý bạn lắm."
    state["suggested_actions"] = []
    return state

def route_after_understand(state: AgentState):
    intent = state.get("intent")
    missing_fields = state.get("missing_fields", [])
    
    if intent in {"direct_answer", "greeting", "capabilities", "error"}:
        return "direct_answer"
        
    if intent not in ["search_events"]:
        return "direct_answer"
        
    if missing_fields:
        return "ask_clarification"
        
    return "search_events"

# Xây dựng graph
def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("understand_query", understand_query_node)
    workflow.add_node("ask_clarification", ask_clarification_node)
    workflow.add_node("search_events", search_events_node)
    workflow.add_node("validate_results", validate_results_node)
    workflow.add_node("compose_response", compose_response_node)
    workflow.add_node("direct_answer", direct_answer_node)
    
    workflow.set_entry_point("understand_query")
    
    workflow.add_conditional_edges(
        "understand_query",
        route_after_understand,
        {
            "ask_clarification": "ask_clarification",
            "search_events": "search_events",
            "direct_answer": "direct_answer"
        }
    )
    
    workflow.add_edge("ask_clarification", END)
    workflow.add_edge("direct_answer", END)
    workflow.add_edge("search_events", "validate_results")
    workflow.add_edge("validate_results", "compose_response")
    workflow.add_edge("compose_response", END)
    
    return workflow.compile()

agent_app = build_graph()
