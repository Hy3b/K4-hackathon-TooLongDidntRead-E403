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
  assert.match(html, /<title>Event AI/);
  assert.match(html, /Trợ lý sự kiện/);
  assert.match(html, /Hôm nay bạn muốn tìm sự kiện gì/);
  assert.match(html, /aria-label="Nhập câu hỏi về sự kiện"/);
  assert.match(html, /Được lưu tự động/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("implements streamed chat, multi-conversation history, and safe persistence", async () => {
  const [page, historyHook, worker, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-chat-history.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(historyHook, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(historyHook, /\/api\/chat\/stream/);
  assert.match(historyHook, /response\.body\.getReader\(\)/);
  assert.match(historyHook, /event\.type === "delta"/);
  assert.match(historyHook, /event\.type === "done"/);
  assert.match(historyHook, /errorCode/);
  assert.match(historyHook, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(historyHook, /localStorage\.setItem\(ACTIVE_KEY/);
  assert.match(historyHook, /fetch\(`\$\{baseUrl\}\/api\/history`/);
  assert.match(historyHook, /buildCompletedHistory/);
  assert.match(historyHook, /function newConversation\(\)/);
  assert.match(historyHook, /function deleteConversation\(/);
  assert.match(historyHook, /conversation_id:\s*conversationId/);
  assert.match(historyHook, /replace\(\/\\\*\\\*\/g, ""\)/);

  assert.match(page, /conversations\.map/);
  assert.match(page, /mobile-history-bar/);
  assert.match(page, /message\.events\.map/);
  assert.match(page, /stream-caret/);
  assert.match(page, /chat-stage/);
  assert.match(page, /history-panel/);
  assert.match(page, /Được lưu tự động/);

  assert.match(worker, /globalThis\.__VLEARN_ENV__ = env/);

  assert.match(layout, /Prototype CP3/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
});

test("keeps the NDJSON stream contract in the client", async () => {
  const historyHook = await readFile(new URL("../app/use-chat-history.ts", import.meta.url), "utf8");
  assert.match(historyHook, /\/api\/chat\/stream/);
  assert.match(historyHook, /event\.type === "status"/);
  assert.match(historyHook, /event\.type === "delta"/);
  assert.match(historyHook, /event\.type === "done"/);
});
