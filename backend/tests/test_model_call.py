import pytest
from langchain_openai import ChatOpenAI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.agent.nodes.understand_query import understand_query_node
from app.main import app


@pytest.fixture
def settings():
    return get_settings()


def test_direct_model_connection(settings):
    """Test trực tiếp gọi API đến Model Server (Ollama / OpenAI endpoint)."""
    assert settings.model_base_url, "MODEL_BASE_URL chưa được cấu hình"
    
    llm = ChatOpenAI(
        model=settings.model_name,
        api_key=settings.model_api_key or "ollama",
        base_url=settings.model_base_url,
        temperature=0.0,
    )
    
    response = llm.invoke("Hãy trả lời đúng duy nhất 1 từ: 'OK'")
    assert response.content is not None
    assert len(response.content.strip()) > 0


def test_agent_understand_query_node(settings):
    """Test node understand_query trong agent gọi model để phân tích intent."""
    state = {
        "conversation_id": "test-conv-1",
        "message": "Tìm sự kiện về công nghệ hôm nay",
        "current_date": "2026-07-31T10:00:00+07:00",
        "warnings": [],
        "missing_fields": [],
        "search_results": [],
        "suggested_actions": []
    }
    
    result_state = understand_query_node(state)
    
    # Kiểm tra intent không bị lỗi
    assert result_state["intent"] != "error", "understand_query_node bị lỗi khi gọi model"
    assert result_state["intent"] == "search_events"


def test_api_chat_endpoint_with_model():
    """Test endpoint POST /api/chat gọi đầy đủ luồng qua model."""
    client = TestClient(app)
    
    payload = {
        "conversation_id": "test-conv-endpoint",
        "message": "Tìm các workshop online tuần này",
        "current_date": "2026-07-31T10:00:00+07:00"
    }
    
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["conversation_id"] == "test-conv-endpoint"
    assert "trace_id" in data
    assert data["intent"] in ["search_events", "ask_clarification", "out_of_scope"]
