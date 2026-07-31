from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Any
from app.database import get_db
import json

router = APIRouter()

class StoredMessage(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)
    createdAt: int
    events: Optional[List[Any]] = []
    warnings: Optional[List[str]] = []
    error: Optional[bool] = False

class StoredConversation(BaseModel):
    id: str
    title: str
    createdAt: int
    updatedAt: int
    messages: List[StoredMessage]

def owner_id_from(x_chat_owner: str) -> str:
    if not x_chat_owner or len(x_chat_owner.strip()) < 8 or len(x_chat_owner.strip()) > 100:
        raise HTTPException(status_code=400, detail="invalid chat owner")
    return x_chat_owner.strip()

@router.get("/history")
def get_history(x_chat_owner: Optional[str] = Header(None)):
    owner_id = owner_id_from(x_chat_owner)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE owner_id = ?
            ORDER BY updated_at DESC
            LIMIT 30
        ''', (owner_id,))
        conversations_rows = cursor.fetchall()
        
        cursor.execute('''
            SELECT id, conversation_id, role, content, payload, created_at
            FROM chat_messages
            WHERE owner_id = ?
            ORDER BY created_at DESC
            LIMIT 600
        ''', (owner_id,))
        messages_rows = cursor.fetchall()
        
    messages_by_conv = {}
    for row in reversed(messages_rows):
        conv_id = row["conversation_id"]
        try:
            payload = json.loads(row["payload"])
        except:
            payload = {}
        
        msg = {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "createdAt": row["created_at"],
            "events": payload.get("events", []),
            "warnings": payload.get("warnings", []),
            "error": payload.get("error", False)
        }
        if conv_id not in messages_by_conv:
            messages_by_conv[conv_id] = []
        messages_by_conv[conv_id].append(msg)
        
    conversations = []
    for row in conversations_rows:
        conv_id = row["id"]
        conversations.append({
            "id": conv_id,
            "title": row["title"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "messages": messages_by_conv.get(conv_id, [])
        })
        
    return {"conversations": conversations}

@router.put("/history")
def put_history(conversation: StoredConversation, x_chat_owner: Optional[str] = Header(None)):
    owner_id = owner_id_from(x_chat_owner)
    
    if not conversation.id or not conversation.title.strip():
        raise HTTPException(status_code=400, detail="invalid conversation")
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT owner_id FROM conversations WHERE id = ?", (conversation.id,))
        existing = cursor.fetchone()
        
        if existing and existing["owner_id"] != owner_id:
            raise HTTPException(status_code=409, detail="conversation id conflict")
            
        cursor.execute('''
            INSERT INTO conversations (id, owner_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                updated_at = excluded.updated_at
        ''', (conversation.id, owner_id, conversation.title.strip()[:80], conversation.createdAt, conversation.updatedAt))
        
        cursor.execute("DELETE FROM chat_messages WHERE owner_id = ? AND conversation_id = ?", (owner_id, conversation.id))
        
        seen_ids = set()
        for msg in conversation.messages[-100:]:
            if msg.id in seen_ids:
                raise HTTPException(status_code=400, detail="duplicate message id")
            seen_ids.add(msg.id)
            payload = json.dumps({
                "events": msg.events,
                "warnings": msg.warnings,
                "error": msg.error
            })
            cursor.execute('''
                INSERT INTO chat_messages (id, conversation_id, owner_id, role, content, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (msg.id, conversation.id, owner_id, msg.role, msg.content, payload, msg.createdAt))
            
        conn.commit()
        
    return {"saved": True}

@router.delete("/history")
def delete_history(id: str, x_chat_owner: Optional[str] = Header(None)):
    owner_id = owner_id_from(x_chat_owner)
    if not id:
        raise HTTPException(status_code=400, detail="id is required")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversations WHERE owner_id = ? AND id = ?", (owner_id, id))
        conn.commit()
        
    return {"deleted": True}
