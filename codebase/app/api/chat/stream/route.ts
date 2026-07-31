type ChatRequest = {
  conversation_id?: string;
  message?: string;
};

const demoEvents = [
  {
    id: "evt_mock_001",
    title: "Workshop CV đầu tiên của bạn",
    topics: ["career"],
    starts_at: "2026-08-01T18:00:00+07:00",
    ends_at: "2026-08-01T20:00:00+07:00",
    registration_deadline: "2026-07-31T10:00:00+07:00",
    location: "Hội trường A",
    organizer: "Phòng CTSV",
    status: "Đang mở",
  },
  {
    id: "evt_mock_002",
    title: "Tech Talk: Từ ý tưởng đến MVP",
    topics: ["technology"],
    starts_at: "2026-08-02T15:00:00+07:00",
    ends_at: "2026-08-02T17:00:00+07:00",
    registration_deadline: "2026-08-01T10:00:00+07:00",
    location: "Lab 5.2",
    organizer: "Khoa CNTT",
    status: "Đang mở",
  },
  {
    id: "evt_mock_003",
    title: "Webinar: Tương lai của AI",
    topics: ["technology"],
    starts_at: "2026-08-07T20:00:00+07:00",
    ends_at: "2026-08-07T21:30:00+07:00",
    registration_deadline: "2026-08-06T10:00:00+07:00",
    location: "Google Meet",
    organizer: "CLB AI",
    status: "Đang mở",
  },
];

function line(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const bodyText = await request.text();
  let payload: ChatRequest = {};
  try {
    payload = JSON.parse(bodyText) as ChatRequest;
  } catch {}

  if (!payload.message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // Attempt proxy to Python Backend first
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    });

    if (backendRes.ok && backendRes.body) {
      return new Response(backendRes.body, {
        status: backendRes.status,
        headers: {
          "Content-Type": backendRes.headers.get("Content-Type") || "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
  } catch (e) {
    // Fallback to mock stream if Python backend is not reachable
  }

  const conversationId = payload.conversation_id || crypto.randomUUID();
  const summary =
    "Mình tìm thấy 3 sự kiện phù hợp trong dữ liệu minh hoạ. Bạn có thể xem thời gian, địa điểm và hạn đăng ký trong các thẻ bên dưới.";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(line({ type: "status", label: "Đang hiểu câu hỏi…" })),
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      controller.enqueue(
        encoder.encode(
          line({ type: "status", label: "Đang tìm sự kiện phù hợp…" }),
        ),
      );

      for (const [index, word] of summary.split(" ").entries()) {
        controller.enqueue(
          encoder.encode(
            line({
              type: "delta",
              text: index === 0 ? word : ` ${word}`,
            }),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 22));
      }

      controller.enqueue(
        encoder.encode(
          line({
            type: "done",
            data: {
              conversation_id: conversationId,
              answer: summary,
              clarifying_question: "",
              intent: "search_events",
              confidence: "high",
              events: demoEvents,
              warnings: [
                "Đây là dữ liệu minh hoạ trên bản triển khai; chạy local để dùng backend Python.",
              ],
              filters: {},
              tool_called: true,
            },
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
