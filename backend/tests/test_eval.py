from eval.run_eval import (
    filters_match,
    groundedness_matches,
    infer_behavior,
    retrieval_matches,
    tool_matches,
)
from app.agent.nodes.understand_query import normalize_filters
from app.agent.nodes.compose_response import compose_grounded_answer


def test_filters_match_normalizes_timezone_and_topic_order():
    expected = {
        "topics": ["technology", "learning"],
        "date_from": "2026-08-04T00:00:00+07:00",
    }
    actual = {
        "topics": ["learning", "technology"],
        "date_from": "2026-08-03T17:00:00+00:00",
        "cost": "any",
    }

    assert filters_match(expected, actual)


def test_filters_match_requires_every_declared_filter():
    assert not filters_match({"event_type": "workshop", "cost": "free"}, {"cost": "free"})


def test_behavior_inference_covers_agent_branches():
    assert infer_behavior({"clarifying_question": "Khi nào?"}) == "ask_clarification"
    assert infer_behavior({"intent": "register_event"}) == "refuse_action"
    assert (
        infer_behavior(
            {
                "intent": "search_events",
                "events": [{"id": "evt_mock_009"}],
                "warnings": ["Thông tin chưa được xác nhận chắc chắn."],
            }
        )
        == "warn_conflict"
    )
    assert infer_behavior({"intent": "search_events", "events": [{"id": "evt_mock_001"}]}) == "answer_with_results"
    assert infer_behavior({"intent": "search_events", "events": []}) == "no_result"


def test_tool_and_retrieval_scoring_are_strict():
    assert tool_matches("answer_with_results", True)
    assert tool_matches("ask_clarification", False)
    assert not tool_matches("refuse_action", True)
    assert retrieval_matches(["evt_mock_001"], ["evt_mock_001"])
    assert not retrieval_matches(["evt_mock_001"], ["evt_mock_001", "evt_mock_002"])


def test_groundedness_rejects_forbidden_claim_and_changed_source_field():
    source = {
        "evt_mock_001": {
            "title": "Workshop CV",
            "starts_at": "2026-08-01T18:00:00+07:00",
            "ends_at": "2026-08-01T20:00:00+07:00",
            "registration_deadline": "2026-07-31T10:00:00+07:00",
            "location": "Hội trường A",
            "status": "published",
        }
    }
    case = {"forbidden_claims": ["đăng ký thành công"]}
    event = {"id": "evt_mock_001", **source["evt_mock_001"]}

    assert groundedness_matches(case, {"answer": "Có một sự kiện.", "events": [event]}, source)
    assert not groundedness_matches(
        case,
        {"answer": "Đăng ký thành công.", "events": [event]},
        source,
    )
    assert not groundedness_matches(
        case,
        {"answer": "Có một sự kiện.", "events": [{**event, "location": "Địa điểm bịa"}]},
        source,
    )


def test_normalize_filters_maps_online_and_calendar_day_boundaries():
    filters = normalize_filters(
        {
            "format": "any",
            "location": "online",
            "date_from": "2026-07-30",
            "date_to": "2026-08-06",
        },
        "Từ hôm nay đến 6/8 có webinar online nào?",
        "2026-07-30T10:00:00+07:00",
    )

    assert filters["format"] == "online"
    assert "location" not in filters
    assert filters["date_from"] == "2026-07-30T00:00:00+07:00"
    assert filters["date_to"] == "2026-08-06T23:59:59+07:00"


def test_grounded_answer_contains_only_structured_event_facts():
    event = {
        "title": "Workshop CV",
        "starts_at": "2026-08-01T18:00:00+07:00",
        "ends_at": "2026-08-01T20:00:00+07:00",
        "registration_deadline": "2026-07-31T10:00:00+07:00",
        "location": "Hội trường A",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_001",
    }

    answer = compose_grounded_answer([event], [])

    assert event["title"] in answer
    assert event["starts_at"] in answer
    assert event["registration_deadline"] in answer
    assert event["location"] in answer
    assert "Mặt Trăng" not in answer
