"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ChatEvent = {
  id: string;
  title: string;
  topics: string[];
  starts_at: string;
  ends_at?: string;
  registration_deadline?: string;
  location?: string;
  organizer?: string;
  status?: string;
  source_url?: string;
};

export type ChatActivity = {
  id: string;
  type: "activity" | "tool_call";
  title?: string;
  details?: string;
  name?: string;
  input?: any;
  output?: any;
  duration?: number;
  status: "pending" | "success" | "error";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  events: ChatEvent[];
  warnings: string[];
  error?: boolean;
  activities: ChatActivity[];
};

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type ChatApiResponse = {
  answer: string;
  clarifyingQuestion: string;
  events: ChatEvent[];
  warnings: string[];
  intent?: string;
  filters?: Record<string, any>;
  toolCalled?: boolean;
};

const STORAGE_KEY = "vlearn-event-ai:conversations:v2";
const OWNER_KEY = "vlearn-event-ai:owner:v1";
const ACTIVE_KEY = "vlearn-event-ai:active-conversation:v1";

function isChatEvent(value: unknown): value is ChatEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    Array.isArray(event.topics) &&
    event.topics.every((topic) => typeof topic === "string") &&
    typeof event.starts_at === "string"
  );
}

function parseChatResponse(value: unknown): ChatApiResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid API response");
  }
  const response = value as Record<string, unknown>;
  const events = response.events;
  const warnings = response.warnings;
  if (!Array.isArray(events) || !events.every(isChatEvent)) {
    throw new Error("Invalid events");
  }
  if (
    !Array.isArray(warnings) ||
    !warnings.every((warning) => typeof warning === "string")
  ) {
    throw new Error("Invalid warnings");
  }
  if (response.answer != null && typeof response.answer !== "string") {
    throw new Error("Invalid answer");
  }
  if (
    response.clarifying_question != null &&
    typeof response.clarifying_question !== "string"
  ) {
    throw new Error("Invalid clarification");
  }
  return {
    answer: cleanMarkdown(response.answer ?? ""),
    clarifyingQuestion: cleanMarkdown(response.clarifying_question ?? ""),
    events,
    warnings,
    intent: response.intent as string | undefined,
    filters: response.filters as Record<string, any> | undefined,
    toolCalled: response.tool_called as boolean | undefined,
  };
}

function cleanMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createConversation(): ChatConversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Cuộc trò chuyện mới",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function titleFrom(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}…` : compact;
}

function getOrCreateOwnerId() {
  let ownerId = window.localStorage.getItem(OWNER_KEY);
  if (!ownerId) {
    ownerId = crypto.randomUUID();
    window.localStorage.setItem(OWNER_KEY, ownerId);
  }
  return ownerId;
}

function readCachedConversations() {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as ChatConversation[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const ownerId = useRef("");
  const latestRequest = useRef(0);
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ownerId.current = getOrCreateOwnerId();
    const cached = readCachedConversations();
    const initial = cached.length ? cached : [createConversation()];
    const cachedActiveId = window.localStorage.getItem(ACTIVE_KEY);
    const initialActiveId = initial.some(
      (conversation) => conversation.id === cachedActiveId,
    )
      ? cachedActiveId!
      : initial[0].id;
    const hydrationTimer = window.setTimeout(() => {
      setConversations(initial);
      setActiveId(initialActiveId);
      setHistoryReady(true);
    }, 0);

    fetch("/api/history", {
      headers: { "x-chat-owner": ownerId.current },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          conversations?: ChatConversation[];
        };
      })
      .then((payload) => {
        if (!payload?.conversations?.length) return;
        setConversations(payload.conversations);
        setActiveId((current) =>
          payload.conversations!.some(
            (conversation) => conversation.id === current,
          )
            ? current
            : payload.conversations![0].id,
        );
      })
      .catch(() => {
        // Local cache remains the offline/local-development fallback.
      });

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, historyReady]);

  useEffect(() => {
    if (!historyReady || !activeId) return;
    window.localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId, historyReady]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeId) ??
      conversations[0],
    [activeId, conversations],
  );

  function updateConversation(
    conversationId: string,
    updater: (conversation: ChatConversation) => ChatConversation,
  ) {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === conversationId
            ? updater(conversation)
            : conversation,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function scheduleRemoteSave(conversationId: string) {
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      const cached = readCachedConversations();
      const conversation = cached.find((item) => item.id === conversationId);
      if (!conversation || !ownerId.current) return;
      fetch("/api/history", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-chat-owner": ownerId.current,
        },
        body: JSON.stringify(conversation),
      }).catch(() => {
        // The device cache already contains the complete conversation.
      });
    }, 350);
  }

  function newConversation() {
    if (loading) return;
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setStreamStatus("");
  }

  function selectConversation(conversationId: string) {
    if (loading) return;
    setActiveId(conversationId);
    setStreamStatus("");
  }

  function deleteConversation(conversationId: string) {
    if (loading) return;
    setConversations((current) => {
      const next = current.filter(
        (conversation) => conversation.id !== conversationId,
      );
      const safeNext = next.length ? next : [createConversation()];
      if (activeId === conversationId) setActiveId(safeNext[0].id);
      return safeNext;
    });
    if (ownerId.current) {
      fetch(`/api/history?id=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
        headers: { "x-chat-owner": ownerId.current },
      }).catch(() => {});
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !activeConversation) return;

    const requestId = ++latestRequest.current;
    const conversationId = activeConversation.id;
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: now,
      events: [],
      warnings: [],
      activities: [],
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now + 1,
      events: [],
      warnings: [],
      activities: [],
    };

    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title:
        conversation.messages.length === 0
          ? titleFrom(trimmed)
          : conversation.title,
      updatedAt: now,
      messages: [...conversation.messages, userMessage, assistantMessage],
    }));
    setLoading(true);
    setStreamStatus("Đang kết nối với trợ lý…");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: trimmed,
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error("Streaming API unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "status" | "delta" | "done" | "activity" | "tool_call";
            label?: string;
            text?: string;
            data?: any;
          };
          if (requestId !== latestRequest.current) return;

          if (event.type === "status") {
            setStreamStatus(event.label ?? "Đang xử lý…");
          }
          if (event.type === "delta" && event.text) {
            streamedText += event.text;
            const content = cleanMarkdown(streamedText);
            updateConversation(conversationId, (conversation) => ({
              ...conversation,
              updatedAt: Date.now(),
              messages: conversation.messages.map((message) =>
                message.id === assistantId
                  ? { ...message, content }
                  : message,
              ),
            }));
          }
          if ((event.type === "activity" || event.type === "tool_call") && event.data) {
            updateConversation(conversationId, (conversation) => ({
              ...conversation,
              updatedAt: Date.now(),
              messages: conversation.messages.map((message) =>
                message.id === assistantId
                  ? { ...message, activities: [...message.activities, event.data as ChatActivity] }
                  : message,
              ),
            }));
          }
          if (event.type === "done") {
            const data = parseChatResponse(event.data);
            const finalContent =
              streamedText.trim() ||
              data.clarifyingQuestion ||
              data.answer ||
              "Mình chưa có câu trả lời phù hợp.";
            updateConversation(conversationId, (conversation) => ({
              ...conversation,
              updatedAt: Date.now(),
              messages: conversation.messages.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: cleanMarkdown(finalContent),
                      events: data.events,
                      warnings: data.warnings,
                    }
                  : message,
              ),
            }));
          }
        }
      }
      scheduleRemoteSave(conversationId);
    } catch {
      updateConversation(conversationId, (conversation) => ({
        ...conversation,
        updatedAt: Date.now(),
        messages: conversation.messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  "Mình chưa kết nối được với backend. Hãy kiểm tra backend đang chạy rồi thử lại.",
                error: true,
              }
            : message,
        ),
      }));
      scheduleRemoteSave(conversationId);
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        setStreamStatus("");
      }
    }
  }

  return {
    conversations,
    activeConversation,
    activeId,
    loading,
    streamStatus,
    historyReady,
    ask,
    newConversation,
    selectConversation,
    deleteConversation,
  };
}
