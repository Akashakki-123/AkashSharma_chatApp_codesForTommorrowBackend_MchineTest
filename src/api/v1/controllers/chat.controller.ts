import { Request, Response } from "express";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  serviceUnavailable,
  success,
  unauthorized,
  unknownError,
} from "../helpers/response.helper.js";
import {
  addGroupMembers,
  createGroupChat,
  createOrGetDirectChat,
  deleteChatMessage,
  editChatMessage,
  getChatMessages,
  getUserChatList,
  markChatMessageRead,
  removeGroupMember,
  sendChatMessage,
  updateChatLastSeen,
} from "../helpers/chat.helper.js";
import {
  chatIdRequiredMessage,
  memberIdRequiredMessage,
  messageIdRequiredMessage,
  userIdRequiredMessage,
} from "../constants/messageConstants.js";

function extractParam(req: Request, key: string): string | null {
  const raw = req.params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() !== "" ? value.trim() : null;
}

function handleFailure(
  res: Response,
  message: string,
  statusCode?: number
): Response {
  switch (statusCode) {
    case 401:
      return unauthorized(res, message);
    case 403:
      return forbidden(res, message);
    case 404:
      return notFound(res, message);
    case 503:
      return serviceUnavailable(res, message);
    default:
      return badRequest(res, message);
  }
}

export async function createChat(req: Request, res: Response): Promise<Response> {
  try {
    const { status, message, data, statusCode } = await createOrGetDirectChat(req);
    if (!status) {
      return handleFailure(res, message, statusCode);
    }
    return statusCode === 201
      ? created(res, message, data)
      : success(res, message, data);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function sendMessage(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await sendChatMessage(chatId, req);
    return status
      ? created(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function getMessages(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await getChatMessages(chatId, req);
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function markMessageRead(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const messageId = extractParam(req, "messageId");
    if (!messageId) {
      return badRequest(res, messageIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await markChatMessageRead(
      chatId,
      messageId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function updateLastSeen(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await updateChatLastSeen(chatId, req);
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function listUserChats(req: Request, res: Response): Promise<Response> {
  try {
    const userId = extractParam(req, "userId");
    if (!userId) {
      return badRequest(res, userIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await getUserChatList(userId, req);
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function createGroup(req: Request, res: Response): Promise<Response> {
  try {
    const { status, message, data, statusCode } = await createGroupChat(req);
    return status
      ? created(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function addMembersToGroup(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await addGroupMembers(chatId, req);
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function removeMemberFromGroup(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const memberId = extractParam(req, "memberId");
    if (!memberId) {
      return badRequest(res, memberIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await removeGroupMember(
      chatId,
      memberId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function editMessage(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const messageId = extractParam(req, "messageId");
    if (!messageId) {
      return badRequest(res, messageIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await editChatMessage(
      chatId,
      messageId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function deleteMessage(req: Request, res: Response): Promise<Response> {
  try {
    const chatId = extractParam(req, "chatId");
    if (!chatId) {
      return badRequest(res, chatIdRequiredMessage);
    }

    const messageId = extractParam(req, "messageId");
    if (!messageId) {
      return badRequest(res, messageIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await deleteChatMessage(
      chatId,
      messageId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailure(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}
