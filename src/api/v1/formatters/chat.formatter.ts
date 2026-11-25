import { Request } from "express";
import { Chat, ChatMember } from "@prisma/client";
import { Timestamp } from "firebase-admin/firestore";
import {
  ChatResponse,
  CreateDirectChatInput,
  CreateGroupChatInput,
  MarkMessageReadInput,
  MessageResponse,
  SendMessageInput,
  UpdateLastSeenInput,
} from "../types/index.js";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createDirectChatFormatter(req: Request): CreateDirectChatInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    userAId: cleanString(body.userAId),
    userBId: cleanString(body.userBId),
  };
}

export function createGroupChatFormatter(req: Request): CreateGroupChatInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawMembers = Array.isArray(body.memberIds) ? body.memberIds : [];
  const memberIds = Array.from(
    new Set(
      rawMembers
        .map((id) => cleanString(id))
        .filter((id) => id !== "")
    )
  );

  return {
    name: cleanString(body.name),
    memberIds,
  };
}

export function addGroupMembersFormatter(req: Request): string[] {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawMembers = Array.isArray(body.memberIds) ? body.memberIds : [];
  return Array.from(
    new Set(
      rawMembers
        .map((id) => cleanString(id))
        .filter((id) => id !== "")
    )
  );
}

export function sendMessageFormatter(req: Request): SendMessageInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    senderId: cleanString(body.senderId),
    text: cleanString(body.text),
  };
}

export function editMessageFormatter(req: Request): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return cleanString(body.text);
}

export function markMessageReadFormatter(req: Request): MarkMessageReadInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    userId: cleanString(body.userId),
  };
}

export function updateLastSeenFormatter(req: Request): UpdateLastSeenInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    userId: cleanString(body.userId),
    messageId: cleanString(body.messageId),
  };
}

export function formatChatResponse(
  chat: Chat & { members: Pick<ChatMember, "userId">[] },
  isNew?: boolean
): ChatResponse {
  return {
    chatId: chat.id,
    isGroup: chat.isGroup,
    name: chat.name,
    memberIds: chat.members.map((member) => member.userId),
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    ...(isNew !== undefined ? { isNew } : {}),
  };
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export function formatMessageResponse(
  messageId: string,
  chatId: string,
  data: Record<string, unknown>
): MessageResponse {
  const rawReadBy = (data.readBy ?? {}) as Record<string, unknown>;
  const readBy: Record<string, string> = {};

  for (const [userId, readAt] of Object.entries(rawReadBy)) {
    const iso = toIsoString(readAt);
    if (iso) {
      readBy[userId] = iso;
    }
  }

  return {
    id: messageId,
    chatId,
    senderId: typeof data.senderId === "string" ? data.senderId : "",
    text: typeof data.text === "string" ? data.text : "",
    isEdited: Boolean(data.isEdited),
    isDeleted: Boolean(data.isDeleted),
    readBy,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}
