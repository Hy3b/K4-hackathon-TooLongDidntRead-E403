type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  events?: unknown[];
  warnings?: string[];
  error?: boolean;
};

type StoredConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
};

type ConversationRow = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  payload: string;
  created_at: number;
};

function ownerIdFrom(request: Request) {
  const ownerId = request.headers.get("x-chat-owner")?.trim() ?? "";
  if (ownerId.length < 8 || ownerId.length > 100) {
    throw new Error("invalid chat owner");
  }
  return ownerId;
}

function database() {
  const db = globalThis.__VLEARN_ENV__?.DB;
  if (!db) throw new Error("history storage unavailable");
  return db;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "unexpected error";
  const unavailable =
    message.includes("unavailable") || message.includes("no such table");
  return Response.json(
    { error: unavailable ? "history storage unavailable" : message },
    { status: unavailable ? 503 : 400 },
  );
}

export async function GET(request: Request) {
  try {
    const ownerId = ownerIdFrom(request);
    const db = database();
    const [conversationResult, messageResult] = await Promise.all([
      db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM conversations
           WHERE owner_id = ?
           ORDER BY updated_at DESC
           LIMIT 30`,
        )
        .bind(ownerId)
        .all<ConversationRow>(),
      db
        .prepare(
          `SELECT id, conversation_id, role, content, payload, created_at
           FROM chat_messages
           WHERE owner_id = ?
           ORDER BY created_at ASC
           LIMIT 600`,
        )
        .bind(ownerId)
        .all<MessageRow>(),
    ]);

    const messagesByConversation = new Map<string, StoredMessage[]>();
    for (const row of messageResult.results) {
      const payload = JSON.parse(row.payload) as Partial<StoredMessage>;
      const message: StoredMessage = {
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        events: Array.isArray(payload.events) ? payload.events : [],
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        error: payload.error === true,
      };
      const current = messagesByConversation.get(row.conversation_id) ?? [];
      current.push(message);
      messagesByConversation.set(row.conversation_id, current);
    }

    return Response.json({
      conversations: conversationResult.results.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: messagesByConversation.get(row.id) ?? [],
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ownerId = ownerIdFrom(request);
    const conversation = (await request.json()) as StoredConversation;
    if (
      !conversation?.id ||
      !conversation.title?.trim() ||
      !Array.isArray(conversation.messages)
    ) {
      return Response.json({ error: "invalid conversation" }, { status: 400 });
    }

    const db = database();
    const existing = await db
      .prepare("SELECT owner_id FROM conversations WHERE id = ?")
      .bind(conversation.id)
      .first<{ owner_id: string }>();
    if (existing && existing.owner_id !== ownerId) {
      return Response.json({ error: "conversation id conflict" }, { status: 409 });
    }

    const statements = [
      db
        .prepare(
          `INSERT INTO conversations
             (id, owner_id, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             updated_at = excluded.updated_at`,
        )
        .bind(
          conversation.id,
          ownerId,
          conversation.title.trim().slice(0, 80),
          conversation.createdAt,
          conversation.updatedAt,
        ),
      db
        .prepare(
          "DELETE FROM chat_messages WHERE owner_id = ? AND conversation_id = ?",
        )
        .bind(ownerId, conversation.id),
      ...conversation.messages.slice(-100).map((message) =>
        db
          .prepare(
            `INSERT INTO chat_messages
               (id, conversation_id, owner_id, role, content, payload, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            message.id,
            conversation.id,
            ownerId,
            message.role,
            message.content,
            JSON.stringify({
              events: message.events ?? [],
              warnings: message.warnings ?? [],
              error: message.error === true,
            }),
            message.createdAt,
          ),
      ),
    ];
    await db.batch(statements);

    return Response.json({ saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ownerId = ownerIdFrom(request);
    const conversationId = new URL(request.url).searchParams.get("id");
    if (!conversationId) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    await database()
      .prepare("DELETE FROM conversations WHERE owner_id = ? AND id = ?")
      .bind(ownerId, conversationId)
      .run();
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
