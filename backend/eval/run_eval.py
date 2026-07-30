import argparse
import csv
import hashlib
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings
from app.agent.nodes.compose_response import compose_grounded_answer


BASE_DIR = Path(__file__).resolve().parent
SETTINGS = get_settings()


def resolve_backend_path(configured_path: str) -> Path:
    path = Path(configured_path)
    return path if path.is_absolute() else (BACKEND_DIR / path).resolve()


GOLDEN_SET_PATH = BASE_DIR / "golden-set.jsonl"
RESULTS_DIR = BASE_DIR / "results"
EVENT_DATA_PATH = resolve_backend_path(SETTINGS.event_data_path)
TRACE_DIR = resolve_backend_path(SETTINGS.trace_dir)
DEFAULT_BASE_URL = os.getenv("EVAL_BASE_URL", "http://localhost:8000")
VIETNAM_TIMEZONE = timezone(timedelta(hours=7))
METRICS = (
    "intent_pass",
    "filter_pass",
    "tool_pass",
    "retrieval_pass",
    "groundedness_pass",
    "behavior_pass",
    "overall_pass",
)


def load_golden_set(raw_bytes: bytes | None = None) -> list[dict[str, Any]]:
    content = (raw_bytes or GOLDEN_SET_PATH.read_bytes()).decode("utf-8")
    return [json.loads(line) for line in content.splitlines() if line.strip()]


def load_events(raw_bytes: bytes | None = None) -> dict[str, dict[str, Any]]:
    content = raw_bytes or EVENT_DATA_PATH.read_bytes()
    return {event["id"]: event for event in json.loads(content)["items"]}


def next_run_id() -> str:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    existing = []
    for path in RESULTS_DIR.glob("run-*.csv"):
        match = re.fullmatch(r"run-(\d+)\.csv", path.name)
        if match:
            existing.append(int(match.group(1)))
    return f"run-{max(existing, default=0) + 1:03d}"


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=VIETNAM_TIMEZONE)
    return parsed


def values_match(expected: Any, actual: Any) -> bool:
    if isinstance(expected, list):
        return isinstance(actual, list) and set(expected) == set(actual)
    if isinstance(expected, str) and isinstance(actual, str):
        if "T" in expected:
            try:
                return parse_datetime(expected) == parse_datetime(actual)
            except ValueError:
                pass
        return expected.casefold() == actual.casefold()
    return expected == actual


def filters_match(expected: dict[str, Any], actual: dict[str, Any]) -> bool:
    return all(key in actual and values_match(value, actual[key]) for key, value in expected.items())


def infer_behavior(response: dict[str, Any]) -> str:
    if response.get("clarifying_question"):
        return "ask_clarification"
    if response.get("intent") != "search_events":
        return "refuse_action"
    warnings = response.get("warnings", [])
    if any("chưa được xác nhận" in warning for warning in warnings):
        return "warn_conflict"
    if response.get("events"):
        return "answer_with_results"
    return "no_result"


def tool_matches(expected_behavior: str, tool_called: bool) -> bool:
    should_call = expected_behavior in {"answer_with_results", "no_result", "warn_conflict"}
    return tool_called is should_call


def retrieval_matches(expected_ids: list[str], actual_ids: list[str]) -> bool:
    return set(expected_ids) == set(actual_ids)


def groundedness_matches(
    case: dict[str, Any],
    response: dict[str, Any],
    source_events: dict[str, dict[str, Any]],
) -> bool:
    answer = (response.get("answer") or response.get("clarifying_question") or "").casefold()
    if any(claim.casefold() in answer for claim in case["forbidden_claims"]):
        return False

    grounded_fields = (
        "title",
        "starts_at",
        "ends_at",
        "registration_deadline",
        "location",
        "status",
        "source_url",
    )
    for event in response.get("events", []):
        source = source_events.get(event.get("id"))
        if source is None:
            return False
        if any(event.get(field) != source.get(field) for field in grounded_fields):
            return False
    if response.get("tool_called"):
        expected_answer = compose_grounded_answer(
            response.get("events", []),
            response.get("warnings", []),
        )
        if response.get("answer") != expected_answer:
            return False
    return True


def score_case(
    case: dict[str, Any],
    response: dict[str, Any],
    source_events: dict[str, dict[str, Any]],
    latency_ms: int,
) -> dict[str, Any]:
    actual_event_ids = [event["id"] for event in response.get("events", [])]
    actual_behavior = infer_behavior(response)
    result = {
        "id": case["id"],
        "intent_pass": response.get("intent") == case["expected_intent"],
        "filter_pass": filters_match(case["expected_filters"], response.get("filters", {})),
        "tool_pass": tool_matches(case["expected_behavior"], response.get("tool_called", False)),
        "retrieval_pass": retrieval_matches(case["expected_event_ids"], actual_event_ids),
        "groundedness_pass": groundedness_matches(case, response, source_events),
        "behavior_pass": actual_behavior == case["expected_behavior"],
        "latency_ms": latency_ms,
        "actual_intent": response.get("intent", ""),
        "actual_behavior": actual_behavior,
        "actual_event_ids": json.dumps(actual_event_ids, ensure_ascii=False),
        "trace_id": response.get("trace_id", ""),
        "error": "",
    }
    result["overall_pass"] = all(result[metric] for metric in METRICS if metric != "overall_pass")
    return result


def failed_result(case_id: str, latency_ms: int, error: str) -> dict[str, Any]:
    result = {
        "id": case_id,
        **{metric: False for metric in METRICS},
        "latency_ms": latency_ms,
        "actual_intent": "",
        "actual_behavior": "",
        "actual_event_ids": "[]",
        "trace_id": "",
        "error": error,
    }
    return result


def write_results(
    run_id: str,
    cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    settings: Any,
    golden_set_bytes: bytes,
    event_data_bytes: bytes,
) -> tuple[Path, Path]:
    csv_path = RESULTS_DIR / f"{run_id}.csv"
    summary_path = RESULTS_DIR / f"{run_id}-summary.md"
    golden_snapshot_path = RESULTS_DIR / f"{run_id}-golden-set.jsonl"
    events_snapshot_path = RESULTS_DIR / f"{run_id}-events.json"
    if any(
        path.exists()
        for path in (csv_path, summary_path, golden_snapshot_path, events_snapshot_path)
    ):
        raise FileExistsError(f"{run_id} already exists; choose a new run ID")

    fieldnames = [
        "id",
        *METRICS,
        "latency_ms",
        "actual_intent",
        "actual_behavior",
        "actual_event_ids",
        "trace_id",
        "error",
    ]
    with tempfile.NamedTemporaryFile(
        "w",
        newline="",
        encoding="utf-8",
        dir=RESULTS_DIR,
        delete=False,
    ) as file:
        temporary_csv = Path(file.name)
        try:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        except Exception:
            temporary_csv.unlink(missing_ok=True)
            raise

    lines = [
        f"# CP3 Eval {run_id}",
        "",
        f"- Run time: {datetime.now(VIETNAM_TIMEZONE).isoformat()}",
        f"- Model: {settings.model_name}",
        f"- Model provider: {settings.model_provider}",
        f"- Prompt version: {settings.prompt_version}",
        f"- Golden set SHA-256: {hashlib.sha256(golden_set_bytes).hexdigest()}",
        f"- Event data SHA-256: {hashlib.sha256(event_data_bytes).hexdigest()}",
        f"- Total cases: {len(cases)}",
    ]
    for metric in METRICS:
        passed = sum(bool(result[metric]) for result in results)
        label = metric.removesuffix("_pass").replace("_", " ").title()
        lines.append(f"- {label}: {passed}/{len(cases)} ({passed / len(cases) * 100:.1f}%)")

    lines.extend(["", "## Failures", ""])
    failures = [result for result in results if not result["overall_pass"]]
    if not failures:
        lines.append("- None")
    else:
        for result in failures:
            failed_metrics = [
                metric.removesuffix("_pass")
                for metric in METRICS
                if metric != "overall_pass" and not result[metric]
            ]
            details = ", ".join(failed_metrics)
            if result["error"]:
                details = f"{details}; error={result['error']}"
            lines.append(f"- {result['id']}: {details}")

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=RESULTS_DIR,
        delete=False,
    ) as file:
        temporary_summary = Path(file.name)
        try:
            file.write("\n".join(lines) + "\n")
        except Exception:
            temporary_csv.unlink(missing_ok=True)
            temporary_summary.unlink(missing_ok=True)
            raise

    os.replace(temporary_csv, csv_path)
    os.replace(temporary_summary, summary_path)
    golden_snapshot_path.write_bytes(golden_set_bytes)
    events_snapshot_path.write_bytes(event_data_bytes)
    return csv_path, summary_path


def export_run_traces(run_id: str, results: list[dict[str, Any]]) -> Path:
    export_dir = RESULTS_DIR / f"{run_id}-traces"
    export_dir.mkdir(exist_ok=False)
    for result in results:
        trace_id = result.get("trace_id")
        if not trace_id:
            continue
        source_path = TRACE_DIR / f"{trace_id}.json"
        if source_path.exists():
            destination = export_dir / f"{result['id']}.json"
            destination.write_bytes(source_path.read_bytes())
    return export_dir


def write_completion_marker(run_id: str, results: list[dict[str, Any]]) -> Path:
    marker_path = RESULTS_DIR / f"{run_id}-complete.json"
    trace_dir = RESULTS_DIR / f"{run_id}-traces"
    marker = {
        "run_id": run_id,
        "case_count": len(results),
        "trace_count": len(list(trace_dir.glob("*.json"))),
        "completed_at": datetime.now(VIETNAM_TIMEZONE).isoformat(),
    }
    temporary_path = RESULTS_DIR / f".{run_id}-complete.tmp"
    temporary_path.write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary_path, marker_path)
    return marker_path


def run_evaluation(base_url: str, run_id: str | None = None) -> tuple[Path, Path]:
    golden_set_bytes = GOLDEN_SET_PATH.read_bytes()
    event_data_bytes = EVENT_DATA_PATH.read_bytes()
    cases = load_golden_set(golden_set_bytes)
    source_events = load_events(event_data_bytes)
    settings = get_settings()
    selected_run_id = run_id or next_run_id()
    results = []

    print(f"Starting {selected_run_id}: {len(cases)} cases")
    with httpx.Client(timeout=45.0) as client:
        for case in cases:
            start_time = time.perf_counter()
            try:
                response = client.post(
                    f"{base_url}/api/chat",
                    json={
                        "conversation_id": f"eval_{selected_run_id}_{case['id']}",
                        "message": case["input"],
                        "current_date": case["current_date"],
                    },
                )
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                response.raise_for_status()
                result = score_case(case, response.json(), source_events, latency_ms)
            except Exception as error:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                result = failed_result(case["id"], latency_ms, str(error))
            results.append(result)
            print(f"{case['id']}: {'PASS' if result['overall_pass'] else 'FAIL'}")

    paths = write_results(
        selected_run_id,
        cases,
        results,
        settings,
        golden_set_bytes,
        event_data_bytes,
    )
    export_run_traces(selected_run_id, results)
    write_completion_marker(selected_run_id, results)
    print(f"Saved {paths[0]}")
    print(f"Saved {paths[1]}")
    return paths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run CP3 golden-set evaluation")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--run-id", help="Explicit ID such as run-002; must not already exist")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    run_evaluation(arguments.base_url, arguments.run_id)
