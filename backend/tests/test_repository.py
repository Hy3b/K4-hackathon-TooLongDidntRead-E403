from app.events.repository import JsonEventRepository


def test_cancelled_events_are_hidden_by_default():
    event_ids = {event["id"] for event in JsonEventRepository().search({"event_type": "fair"})}

    assert "evt_mock_010" not in event_ids


def test_cancelled_events_can_be_returned_for_explicit_named_search():
    event_ids = {
        event["id"]
        for event in JsonEventRepository().search(
            {"event_type": "fair", "include_cancelled": True}
        )
    }

    assert "evt_mock_010" in event_ids


def test_date_filters_compare_absolute_instants_across_offsets():
    event_ids = {
        event["id"]
        for event in JsonEventRepository().search(
            {"date_from": "2026-08-01T12:00:00+00:00"}
        )
    }

    assert "evt_mock_001" not in event_ids
