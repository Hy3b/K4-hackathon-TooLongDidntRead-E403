from typing import Any

from app.agent.state import AgentState


def compose_grounded_answer(
    events: list[dict[str, Any]],
    warnings: list[str],
) -> str:
    if not events:
        return "Chưa tìm thấy sự kiện phù hợp. Bạn có thể đổi thời gian, chủ đề hoặc điều kiện tìm kiếm."

    lines = ["Các sự kiện phù hợp:"]
    for event in events[:3]:
        lines.append(
                "- {title} | {starts_at}–{ends_at} | {location} | "
            "hạn đăng ký: {registration_deadline} | trạng thái: {status} | {source_url}".format(
                title=event.get("title") or "Không rõ tên",
                starts_at=event.get("starts_at") or "Chưa rõ thời gian",
                ends_at=event.get("ends_at") or "Chưa rõ thời gian",
                location=event.get("location") or "Chưa rõ địa điểm",
                registration_deadline=event.get("registration_deadline") or "Chưa rõ",
                status=event["status"],
                source_url=event.get("source_url") or "Không có URL",
            )
        )
    if warnings:
        lines.append("Cảnh báo: " + " ".join(warnings))
    return "\n".join(lines)


def compose_response_node(state: AgentState):
    events = state.get("search_results", [])
    warnings = state.get("warnings", [])
    state["answer"] = compose_grounded_answer(events, warnings)
    state["suggested_actions"] = ["view_detail", "create_reminder"] if events else []
    return state
