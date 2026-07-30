import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from app.config import get_settings

class TraceStore:
    def __init__(self):
        self.settings = get_settings()
        self.trace_dir = Path(self.settings.trace_dir)
        self.trace_dir.mkdir(parents=True, exist_ok=True)

    def save_trace(self, trace_data: dict):
        trace_id = trace_data.get("trace_id", f"run_{uuid4().hex}")
        file_path = self.trace_dir / f"{trace_id}.json"
        temporary_path = self.trace_dir / f".{trace_id}.{uuid4().hex}.tmp"
        
        # Add timestamp if not exists
        if "timestamp" not in trace_data:
            trace_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            
        with temporary_path.open("w", encoding="utf-8") as file:
            json.dump(trace_data, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_path, file_path)
        self._enforce_retention()

    def _enforce_retention(self) -> None:
        trace_files = sorted(
            self.trace_dir.glob("*.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for stale_path in trace_files[self.settings.trace_max_files:]:
            stale_path.unlink(missing_ok=True)
            
trace_store = TraceStore()
