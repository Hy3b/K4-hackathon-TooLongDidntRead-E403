import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function fetchWorker(request) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    request,
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render() {
  return fetchWorker(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
  );
}

test("server-renders the event assistant shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="vi">/i);
  assert.match(html, /<title>VLearn Event AI/);
  assert.match(html, /Trợ lý sự kiện VLearn/);
  assert.match(html, /Hôm nay bạn muốn tìm sự kiện gì/);
  assert.match(html, /aria-label="Nhập câu hỏi về sự kiện"/);
  assert.match(html, /Được lưu tự động/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("implements streamed chat, multi-conversation history, and safe persistence", async () => {
  const [page, historyHook, streamRoute, historyRoute, worker, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-chat-history.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(historyHook, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(historyHook, /\/api\/chat\/stream/);
  assert.match(historyHook, /response\.body\.getReader\(\)/);
  assert.match(historyHook, /event\.type === "delta"/);
  assert.match(historyHook, /event\.type === "done"/);
  assert.match(historyHook, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(historyHook, /localStorage\.setItem\(ACTIVE_KEY/);
  assert.match(historyHook, /fetch\("\/api\/history"/);
  assert.match(historyHook, /function newConversation\(\)/);
  assert.match(historyHook, /function deleteConversation\(/);
  assert.match(historyHook, /conversation_id:\s*conversationId/);
  assert.match(historyHook, /replace\(\/\\\*\\\*\/g, ""\)/);
  assert.match(streamRoute, /ReadableStream/);
  assert.match(streamRoute, /type: "delta"/);
  assert.match(streamRoute, /type: "done"/);
  assert.match(streamRoute, /dữ liệu minh hoạ/);

  assert.match(page, /conversations\.map/);
  assert.match(page, /mobile-history-bar/);
  assert.match(page, /message\.events\.map/);
  assert.match(page, /stream-caret/);
  assert.match(page, /Đã tạo lời nhắc \(Mock\)/);

  assert.match(historyRoute, /globalThis\.__VLEARN_ENV__\?\.DB/);
  assert.match(historyRoute, /\.prepare\(/);
  assert.match(historyRoute, /\.bind\(/);
  assert.match(historyRoute, /existing\.owner_id !== ownerId/);
  assert.match(worker, /globalThis\.__VLEARN_ENV__ = env/);

  assert.match(layout, /Prototype CP3/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
});

test("streams the deployed demo fallback as NDJSON", async () => {
  const response = await fetchWorker(
    new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: "test-conversation",
        message: "Sự kiện nào sắp hết hạn?",
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/x-ndjson\b/i,
  );
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((entry) => JSON.parse(entry));
  assert.equal(events[0].type, "status");
  assert.ok(events.some((event) => event.type === "delta"));
  const done = events.find((event) => event.type === "done");
  assert.equal(done.data.events.length, 3);
  assert.doesNotMatch(done.data.answer, /\*\*/);
});
