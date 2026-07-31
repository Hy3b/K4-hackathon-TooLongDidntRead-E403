import json
import asyncio

from app.agent.graph import direct_answer_node
from app.api import chat as chat_api
from app.api.chat import ChatResponse
from app.agent.nodes.compose_response import compose_grounded_answer
from app.agent.nodes.understand_query import understand_query_node
from app.agent.nodes.validate_results import validate_results_node
from app.events.repository import JsonEventRepository


def test_greeting_propagates_deterministic_direct_answer():
    state = {"message": "Xin chào", "history": [], "current_date": "2026-07-31T10:00:00+07:00"}
    result = understand_query_node(state)
    assert result["intent"] == "greeting"
    assert result["direct_answer"]
    assert direct_answer_node(result)["answer"] == result["direct_answer"]


def test_conflict_warning_is_user_visible():
    state = {"search_results": [{"id": "e1", "title": "Demo", "status": "needs_confirmation", "conflicts": [{"field": "starts_at"}]}], "warnings": []}
    result = validate_results_node(state)
    assert result["conflicts"]
    assert any("mâu thuẫn" in warning for warning in result["warnings"])
    assert "Cảnh báo" in compose_grounded_answer(result["search_results"], result["warnings"])


def test_repository_date_filter_uses_absolute_instants():
    ids = {event["id"] for event in JsonEventRepository().search({"date_from": "2026-08-01T12:00:00+00:00"})}
    assert "evt_mock_001" not in ids


def test_chat_stream_emits_typed_ndjson_contract(monkeypatch):
    async def fake_chat_endpoint(request):
        return ChatResponse(
            conversation_id=request.conversation_id,
            trace_id="run_test",
            answer="Xin chào",
            intent="greeting",
            confidence="high",
        )

    monkeypatch.setattr(chat_api, "chat_endpoint", fake_chat_endpoint)
    async def collect():
        response = await chat_api.chat_stream_endpoint(
            chat_api.ChatRequest(conversation_id="c1", message="Xin chào")
        )
        return [json.loads(line) async for line in response.body_iterator]

    lines = asyncio.run(collect())
    assert lines[0]["type"] == "status"
    assert lines[-1]["type"] == "done"
    assert any(line["type"] == "delta" for line in lines)
    assert lines[-1]["data"]["trace_id"] == "run_test"
