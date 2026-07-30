import json
from datetime import datetime, timedelta
from pathlib import Path

# Default to roughly current time for mock generation
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
NOW = datetime.fromisoformat("2026-07-30T10:00:00+07:00")

def date_str(days=0, hours=0):
    return (NOW + timedelta(days=days, hours=hours)).isoformat()

events = [
    {
        "id": "evt_mock_001",
        "is_mock": True,
        "title": "Workshop CV đầu tiên của bạn",
        "description": "Workshop hướng dẫn sinh viên chuẩn bị CV.",
        "topics": ["career", "skills"],
        "event_type": "workshop",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=2, hours=8),
        "ends_at": date_str(days=2, hours=10),
        "registration_deadline": date_str(days=1),
        "location": "Hội trường A",
        "organizer": "Phòng CTSV",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_001",
        "updated_at": date_str(days=-1),
        "conflicts": []
    },
    {
        "id": "evt_mock_002",
        "is_mock": True,
        "title": "Tech Talk: Từ ý tưởng đến MVP",
        "description": "Chia sẻ kinh nghiệm xây dựng MVP từ các startup công nghệ.",
        "topics": ["technology"],
        "event_type": "talkshow",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=3, hours=5), # this weekend
        "ends_at": date_str(days=3, hours=7),
        "registration_deadline": date_str(days=2),
        "location": "Lab 5.2",
        "organizer": "Khoa CNTT",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_002",
        "updated_at": date_str(days=-2),
        "conflicts": []
    },
    {
        "id": "evt_mock_003",
        "is_mock": True,
        "title": "Giao lưu sinh viên 5 tốt",
        "description": "Sự kiện miễn phí giao lưu sinh viên.",
        "topics": ["community"],
        "event_type": "networking",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=0, hours=9), # today
        "ends_at": date_str(days=0, hours=11),
        "registration_deadline": date_str(days=-1),
        "location": "Sân trường",
        "organizer": "Đoàn Thanh niên",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_003",
        "updated_at": date_str(days=-3),
        "conflicts": []
    },
    {
        "id": "evt_mock_004",
        "is_mock": True,
        "title": "Webinar: Tương lai của AI",
        "description": "Sự kiện online miễn phí về AI.",
        "topics": ["technology"],
        "event_type": "webinar",
        "format": "online",
        "cost": "free",
        "starts_at": date_str(days=8, hours=10), # next week
        "ends_at": date_str(days=8, hours=12),
        "registration_deadline": date_str(days=7),
        "location": "Google Meet",
        "organizer": "CLB AI",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_004",
        "updated_at": date_str(days=-1),
        "conflicts": []
    },
    {
        "id": "evt_mock_005",
        "is_mock": True,
        "title": "Workshop Kỹ năng thuyết trình",
        "description": "Kỹ năng thuyết trình chuyên nghiệp.",
        "topics": ["skills"],
        "event_type": "workshop",
        "format": "offline",
        "cost": "paid",
        "starts_at": date_str(days=15, hours=8), # this month
        "ends_at": date_str(days=15, hours=11),
        "registration_deadline": date_str(days=10),
        "location": "Phòng 301",
        "organizer": "Trung tâm kỹ năng mềm",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_005",
        "updated_at": date_str(days=-5),
        "conflicts": []
    },
    {
        "id": "evt_mock_006",
        "is_mock": True,
        "title": "Cuộc thi lập trình Hackathon K4",
        "description": "Cuộc thi lập trình lớn nhất trường.",
        "topics": ["technology", "learning"],
        "event_type": "competition",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=20, hours=0),
        "ends_at": date_str(days=22, hours=0),
        "registration_deadline": date_str(days=10),
        "location": "Nhà thi đấu",
        "organizer": "Khoa CNTT",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_006",
        "updated_at": date_str(days=-5),
        "conflicts": []
    },
    {
        "id": "evt_mock_007",
        "is_mock": True,
        "title": "Seminar Blockchain: Cơ hội và Thách thức",
        "description": "Tìm hiểu về blockchain tại Đà Nẵng.",
        "topics": ["technology"],
        "event_type": "seminar",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=30, hours=8),
        "ends_at": date_str(days=30, hours=11),
        "registration_deadline": date_str(days=25),
        "location": "Khách sạn X, Đà Nẵng",
        "organizer": "Tech Danang",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_007",
        "updated_at": date_str(days=-10),
        "conflicts": []
    },
    {
        "id": "evt_mock_008",
        "is_mock": True,
        "title": "Talkshow Hành trang du học",
        "description": "Chuẩn bị gì để đi du học?",
        "topics": ["learning"],
        "event_type": "talkshow",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=4, hours=6),
        "ends_at": date_str(days=4, hours=8),
        "registration_deadline": date_str(days=3),
        "location": "Hội trường B",
        "organizer": "Phòng Hợp tác Quốc tế",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_008",
        "updated_at": date_str(days=-2),
        "conflicts": []
    },
    # needs_confirmation conflict
    {
        "id": "evt_mock_009",
        "is_mock": True,
        "title": "Workshop Data Science",
        "description": "Workshop thực hành Data Science.",
        "topics": ["technology", "learning"],
        "event_type": "workshop",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=5, hours=7),
        "ends_at": date_str(days=5, hours=9),
        "registration_deadline": date_str(days=4),
        "location": "Lab 2.1",
        "organizer": "CLB Data",
        "status": "needs_confirmation",
        "source_url": "https://example.invalid/events/evt_mock_009",
        "updated_at": date_str(days=-1),
        "conflicts": [
            {
                "field": "starts_at",
                "values": [date_str(days=5, hours=7), date_str(days=5, hours=8)]
            }
        ]
    },
    # cancelled
    {
        "id": "evt_mock_010",
        "is_mock": True,
        "title": "Ngày hội việc làm Job Fair 2026",
        "description": "Ngày hội việc làm",
        "topics": ["career", "community"],
        "event_type": "fair",
        "format": "offline",
        "cost": "free",
        "starts_at": date_str(days=10, hours=1),
        "ends_at": date_str(days=10, hours=9),
        "registration_deadline": date_str(days=5),
        "location": "Sân vận động",
        "organizer": "Phòng CTSV",
        "status": "cancelled",
        "source_url": "https://example.invalid/events/evt_mock_010",
        "updated_at": date_str(days=-1),
        "conflicts": []
    },
    # past deadline
    {
        "id": "evt_mock_011",
        "is_mock": True,
        "title": "Khóa học Kỹ năng lãnh đạo",
        "description": "Dành cho cán bộ Đoàn Hội",
        "topics": ["skills", "learning"],
        "event_type": "course",
        "format": "offline",
        "cost": "paid",
        "starts_at": date_str(days=5, hours=8),
        "ends_at": date_str(days=5, hours=11),
        "registration_deadline": date_str(days=-2), # past deadline
        "location": "Phòng họp 1",
        "organizer": "Đoàn Thanh niên",
        "status": "published",
        "source_url": "https://example.invalid/events/evt_mock_011",
        "updated_at": date_str(days=-3),
        "conflicts": []
    }
]

with (DATA_DIR / 'events.json').open('w', encoding='utf-8') as f:
    json.dump({"items": events, "total": len(events), "data_version": "cp3-seed-v1"}, f, ensure_ascii=False, indent=2)

print("Created backend/data/events.json")

# Golden set is curated manually in eval/golden-set.jsonl.
# Do not regenerate it from mock-data code: eval cases are immutable test evidence.
with (DATA_DIR / 'README.md').open('w', encoding='utf-8') as f:
    f.write("# Mock Event Data\n\nDữ liệu tự sinh cho hackathon, không đại diện cho sự kiện thật. Các sự kiện bao gồm mâu thuẫn giờ, hết hạn, và hủy bỏ để test AI.\n")

with (DATA_DIR / 'data-version.txt').open('w', encoding='utf-8') as f:
    f.write("cp3-seed-v1\n")

