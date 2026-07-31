import sys
sys.path.append(".")
import traceback
import json
from app.agent.nodes.understand_query import understand_query_node

def main():
    state = {
        "message": "Có sự kiện nào trong tuần này không?",
        "current_date": "2026-07-31T09:44:34+07:00",
        "intent": "",
        "confidence": "",
        "missing_fields": [],
        "filters": {}
    }
    
    try:
        new_state = understand_query_node(state)
        with open("test_out.json", "w", encoding="utf-8") as f:
            json.dump(new_state, f, ensure_ascii=False)
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    main()
