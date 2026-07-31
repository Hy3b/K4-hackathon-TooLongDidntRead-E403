from app.agent.state import AgentState

def validate_results_node(state: AgentState):
    results = state.get("search_results", [])
    conflicts = []
    warnings = list(state.get("warnings", []))
    
    for event in results:
        if event.get("status") == "cancelled":
            warnings.append(f"Sự kiện '{event.get('title')}' đã bị hủy.")

        if event.get("status") == "needs_confirmation":
            event_conflicts = event.get("conflicts", [])
            if event_conflicts:
                conflicts.append({
                    "event_id": event["id"],
                    "conflicts": event_conflicts
                })
                warnings.append(
                    f"Thông tin của sự kiện '{event.get('title', 'không rõ tên')}' có mâu thuẫn; hãy kiểm tra nguồn chính thức."
                )
                
    state["conflicts"] = conflicts
    state["warnings"] = warnings
    
    return state
