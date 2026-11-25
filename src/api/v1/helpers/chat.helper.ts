import { Request } from "express";
import { Chat, ChatMember, Prisma } from "@prisma/client";
import { DocumentReference, FieldValue, Firestore } from "firebase-admin/firestore";
import prisma from "../config/db.js";
import { getFirestoreDb } from "../config/firebase.js";
import { FormatterResult, returnFormatter } from "../formatters/common.formatter.js";
import {
  addGroupMembersFormatter,
  createDirectChatFormatter,
  createGroupChatFormatter,
  editMessageFormatter,
  formatChatResponse,
  formatMessageResponse,
  markMessageReadFormatter,
  sendMessageFormatter,
  updateLastSeenFormatter,
} from "../formatters/chat.formatter.js";
import { isValidUuid } from "../formatters/user.formatter.js";
import {
  ChatResponse,
  LastSeenResponse,
  MessageResponse,
} from "../types/index.js";
import {
  chatCreatedNewMessage,
  chatCreateSuccessMessage,
  chatIdRequiredMessage,
  chatMemberNotFoundMessage,
  chatMemberRemovedMessage,
  chatMembersAddedMessage,
  chatMembershipDeniedMessage,
  chatNotFoundMessage,
  chatParticipantsNotFoundMessage,
  chatUsersRequiredMessage,
  firebaseNotConfiguredMessage,
  groupChatCreatedMessage,
  groupMembersRequiredMessage,
  groupNameRequiredMessage,
  groupRemovePermissionMessage,
  invalidChatIdMessage,
  invalidUserIdMessage,
  lastSeenFieldsRequiredMessage,
  lastSeenUpdatedMessage,
  memberIdRequiredMessage,
  memberIdsRequiredMessage,
  messageDeletedAlreadyMessage,
  messageDeletedSuccessMessage,
  messageIdRequiredMessage,
  messageNotFoundMessage,
  messageOwnerOnlyMessage,
  messageReadSuccessMessage,
  messageSendFieldsRequiredMessage,
  messageSentSuccessMessage,
  messagesRetrievedMessage,
  messageTextRequiredMessage,
  messageUpdatedSuccessMessage,
  notGroupChatMessage,
  sameChatUsersErrorMessage,
  senderMismatchMessage,
  unauthorizedMessage,
  userAccessDeniedMessage,
  userChatsSuccessMessage,
  userIdMismatchMessage,
  userIdRequiredMessage,
  userNotFoundMessage,
} from "../constants/messageConstants.js";

const DEFAULT_MESSAGES_LIMIT = 50;
const MAX_MESSAGES_LIMIT = 100;

type ChatWithMembers = Chat & { members: Pick<ChatMember, "userId">[] };

function getAuthUserId(req: Request): string {
  return req.user?.id ?? "";
}

function getFirestoreOrError(): { db: Firestore | null; error?: FormatterResult<never> } {
  const db = getFirestoreDb();
  if (!db) {
    return {
      db: null,
      error: returnFormatter(false, firebaseNotConfiguredMessage, undefined, 503),
    };
  }
  return { db };
}

async function verifyActiveUsers(userIds: string[]): Promise<boolean> {
  const activeUsers = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      isDeleted: false,
    },
    select: { id: true },
  });
  return activeUsers.length === userIds.length;
}

async function verifyChatMembership(
  chatId: string,
  userId: string
): Promise<{ chat: ChatWithMembers | null; error?: FormatterResult<never> }> {
  if (!chatId) {
    return {
      chat: null,
      error: returnFormatter(false, chatIdRequiredMessage, undefined, 400),
    };
  }

  if (!isValidUuid(chatId)) {
    return {
      chat: null,
      error: returnFormatter(false, invalidChatIdMessage, undefined, 400),
    };
  }

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (!chat) {
    return {
      chat: null,
      error: returnFormatter(false, chatNotFoundMessage, undefined, 404),
    };
  }

  const isMember = chat.members.some((member) => member.userId === userId);
  if (!isMember) {
    return {
      chat: null,
      error: returnFormatter(false, chatMembershipDeniedMessage, undefined, 403),
    };
  }

  return { chat };
}

export async function createOrGetDirectChat(
  req: Request
): Promise<FormatterResult<ChatResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const { userAId, userBId } = createDirectChatFormatter(req);

  if (!userAId || !userBId) {
    return returnFormatter(false, chatUsersRequiredMessage, undefined, 400);
  }

  if (!isValidUuid(userAId) || !isValidUuid(userBId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (userAId === userBId) {
    return returnFormatter(false, sameChatUsersErrorMessage, undefined, 400);
  }

  if (
    req.user?.role !== "ADMIN" &&
    authUserId !== userAId &&
    authUserId !== userBId
  ) {
    return returnFormatter(false, chatMembershipDeniedMessage, undefined, 403);
  }

  const usersExist = await verifyActiveUsers([userAId, userBId]);
  if (!usersExist) {
    return returnFormatter(false, chatParticipantsNotFoundMessage, undefined, 404);
  }

  const directKey = [userAId, userBId].sort().join(":");

  const existingChat = await prisma.chat.findUnique({
    where: { directKey },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (existingChat) {
    return returnFormatter(
      true,
      chatCreateSuccessMessage,
      formatChatResponse(existingChat, false),
      200
    );
  }

  try {
    const newChat = await prisma.chat.create({
      data: {
        isGroup: false,
        directKey,
        createdById: authUserId,
        members: {
          create: [{ userId: userAId }, { userId: userBId }],
        },
      },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    return returnFormatter(
      true,
      chatCreatedNewMessage,
      formatChatResponse(newChat, true),
      201
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentChat = await prisma.chat.findUnique({
        where: { directKey },
        include: { members: { select: { userId: true } } },
      });
      if (concurrentChat) {
        return returnFormatter(
          true,
          chatCreateSuccessMessage,
          formatChatResponse(concurrentChat, false),
          200
        );
      }
    }
    throw error;
  }
}

export async function sendChatMessage(
  chatId: string,
  req: Request
): Promise<FormatterResult<MessageResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const { senderId, text } = sendMessageFormatter(req);

  if (!senderId || !text) {
    return returnFormatter(false, messageSendFieldsRequiredMessage, undefined, 400);
  }

  if (!isValidUuid(senderId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (senderId !== authUserId) {
    return returnFormatter(false, senderMismatchMessage, undefined, 403);
  }

  const membershipCheck = await verifyChatMembership(chatId, senderId);
  if (membershipCheck.error) {
    return membershipCheck.error;
  }

  const firestoreCheck = getFirestoreOrError();
  if (firestoreCheck.error || !firestoreCheck.db) {
    return firestoreCheck.error!;
  }

  const messagesRef = firestoreCheck.db
    .collection("chats")
    .doc(chatId)
    .collection("messages");

  const docRef = messagesRef.doc();

  await docRef.set({
    senderId,
    text,
    isEdited: false,
    isDeleted: false,
    readBy: {
      [senderId]: FieldValue.serverTimestamp(),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: null,
  });

  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  const savedSnapshot = await docRef.get();
  const savedData = (savedSnapshot.data() ?? {}) as Record<string, unknown>;

  return returnFormatter(
    true,
    messageSentSuccessMessage,
    formatMessageResponse(docRef.id, chatId, savedData),
    201
  );
}

export async function getChatMessages(
  chatId: string,
  req: Request
): Promise<
  FormatterResult<{
    chatId: string;
    count: number;
    messages: MessageResponse[];
  }>
> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const membershipCheck = await verifyChatMembership(chatId, authUserId);
  if (membershipCheck.error) {
    return membershipCheck.error;
  }

  const firestoreCheck = getFirestoreOrError();
  if (firestoreCheck.error || !firestoreCheck.db) {
    return firestoreCheck.error!;
  }

  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_MESSAGES_LIMIT)
      : DEFAULT_MESSAGES_LIMIT;

  const snapshot = await firestoreCheck.db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const messages = snapshot.docs
    .reverse()
    .map((doc) =>
      formatMessageResponse(doc.id, chatId, doc.data() as Record<string, unknown>)
    );

  return returnFormatter(true, messagesRetrievedMessage, {
    chatId,
    count: messages.length,
    messages,
  });
}

export async function markChatMessageRead(
  chatId: string,
  messageId: string,
  req: Request
): Promise<FormatterResult<MessageResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  if (!messageId) {
    return returnFormatter(false, messageIdRequiredMessage, undefined, 400);
  }

  const { userId } = markMessageReadFormatter(req);
  if (!userId) {
    return returnFormatter(false, userIdRequiredMessage, undefined, 400);
  }

  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (userId !== authUserId) {
    return returnFormatter(false, userIdMismatchMessage, undefined, 403);
  }

  const membershipCheck = await verifyChatMembership(chatId, userId);
  if (membershipCheck.error) {
    return membershipCheck.error;
  }

  const firestoreCheck = getFirestoreOrError();
  if (firestoreCheck.error || !firestoreCheck.db) {
    return firestoreCheck.error!;
  }

  const messageRef = firestoreCheck.db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .doc(messageId);

  const messageSnapshot = await messageRef.get();
  if (!messageSnapshot.exists) {
    return returnFormatter(false, messageNotFoundMessage, undefined, 404);
  }

  const messageData = (messageSnapshot.data() ?? {}) as Record<string, unknown>;
  if (messageData.isDeleted) {
    return returnFormatter(false, messageDeletedAlreadyMessage, undefined, 400);
  }

  await messageRef.update({
    [`readBy.${userId}`]: FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await messageRef.get();
  const updatedData = (updatedSnapshot.data() ?? {}) as Record<string, unknown>;

  return returnFormatter(
    true,
    messageReadSuccessMessage,
    formatMessageResponse(messageId, chatId, updatedData)
  );
}

export async function updateChatLastSeen(
  chatId: string,
  req: Request
): Promise<FormatterResult<LastSeenResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const { userId, messageId } = updateLastSeenFormatter(req);

  if (!userId || !messageId) {
    return returnFormatter(false, lastSeenFieldsRequiredMessage, undefined, 400);
  }

  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (userId !== authUserId) {
    return returnFormatter(false, userIdMismatchMessage, undefined, 403);
  }

  const membershipCheck = await verifyChatMembership(chatId, userId);
  if (membershipCheck.error) {
    return membershipCheck.error;
  }

  const firestoreCheck = getFirestoreOrError();
  if (firestoreCheck.error || !firestoreCheck.db) {
    return firestoreCheck.error!;
  }

  const chatRef = firestoreCheck.db.collection("chats").doc(chatId);
  const messageSnapshot = await chatRef.collection("messages").doc(messageId).get();

  if (!messageSnapshot.exists) {
    return returnFormatter(false, messageNotFoundMessage, undefined, 404);
  }

  const lastSeenRef = chatRef.collection("lastSeen").doc(userId);
  await lastSeenRef.set(
    {
      userId,
      messageId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const savedLastSeen = await lastSeenRef.get();
  const savedData = (savedLastSeen.data() ?? {}) as Record<string, unknown>;
  const rawUpdatedAt = savedData.updatedAt as { toDate?: () => Date } | undefined;

  return returnFormatter(true, lastSeenUpdatedMessage, {
    chatId,
    userId,
    messageId,
    updatedAt:
      rawUpdatedAt && typeof rawUpdatedAt.toDate === "function"
        ? rawUpdatedAt.toDate().toISOString()
        : new Date().toISOString(),
  });
}

export async function getUserChatList(
  userId: string,
  req: Request
): Promise<
  FormatterResult<{
    userId: string;
    count: number;
    chats: ChatResponse[];
  }>
> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (req.user?.role !== "ADMIN" && authUserId !== userId) {
    return returnFormatter(false, userAccessDeniedMessage, undefined, 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { id: true },
  });

  if (!user) {
    return returnFormatter(false, userNotFoundMessage, undefined, 404);
  }

  const chats = await prisma.chat.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        select: { userId: true },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const formattedChats = chats.map((chat) => formatChatResponse(chat));

  return returnFormatter(true, userChatsSuccessMessage, {
    userId,
    count: formattedChats.length,
    chats: formattedChats,
  });
}

// Bonus: Group Chat & Message Edit/Delete

export async function createGroupChat(
  req: Request
): Promise<FormatterResult<ChatResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const { name, memberIds } = createGroupChatFormatter(req);

  if (!name) {
    return returnFormatter(false, groupNameRequiredMessage, undefined, 400);
  }

  const uniqueMemberIds = Array.from(new Set([authUserId, ...memberIds]));
  if (uniqueMemberIds.length < 2) {
    return returnFormatter(false, groupMembersRequiredMessage, undefined, 400);
  }

  if (uniqueMemberIds.some((id) => !isValidUuid(id))) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  const usersExist = await verifyActiveUsers(uniqueMemberIds);
  if (!usersExist) {
    return returnFormatter(false, chatParticipantsNotFoundMessage, undefined, 404);
  }

  const groupChat = await prisma.chat.create({
    data: {
      isGroup: true,
      name,
      createdById: authUserId,
      members: {
        create: uniqueMemberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  return returnFormatter(
    true,
    groupChatCreatedMessage,
    formatChatResponse(groupChat, true),
    201
  );
}

export async function addGroupMembers(
  chatId: string,
  req: Request
): Promise<FormatterResult<ChatResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const membershipCheck = await verifyChatMembership(chatId, authUserId);
  if (membershipCheck.error || !membershipCheck.chat) {
    return membershipCheck.error!;
  }

  if (!membershipCheck.chat.isGroup) {
    return returnFormatter(false, notGroupChatMessage, undefined, 400);
  }

  const memberIds = addGroupMembersFormatter(req);
  if (memberIds.length === 0) {
    return returnFormatter(false, memberIdsRequiredMessage, undefined, 400);
  }

  if (memberIds.some((id) => !isValidUuid(id))) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  const usersExist = await verifyActiveUsers(memberIds);
  if (!usersExist) {
    return returnFormatter(false, chatParticipantsNotFoundMessage, undefined, 404);
  }

  await prisma.chatMember.createMany({
    data: memberIds.map((userId) => ({ chatId, userId })),
    skipDuplicates: true,
  });

  const updatedChat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  return returnFormatter(
    true,
    chatMembersAddedMessage,
    formatChatResponse(updatedChat!)
  );
}

export async function removeGroupMember(
  chatId: string,
  memberId: string,
  req: Request
): Promise<FormatterResult<ChatResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  if (!memberId) {
    return returnFormatter(false, memberIdRequiredMessage, undefined, 400);
  }

  if (!isValidUuid(memberId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  const membershipCheck = await verifyChatMembership(chatId, authUserId);
  if (membershipCheck.error || !membershipCheck.chat) {
    return membershipCheck.error!;
  }

  if (!membershipCheck.chat.isGroup) {
    return returnFormatter(false, notGroupChatMessage, undefined, 400);
  }

  if (
    membershipCheck.chat.createdById !== authUserId &&
    memberId !== authUserId
  ) {
    return returnFormatter(false, groupRemovePermissionMessage, undefined, 403);
  }

  const targetIsMember = membershipCheck.chat.members.some(
    (member) => member.userId === memberId
  );
  if (!targetIsMember) {
    return returnFormatter(false, chatMemberNotFoundMessage, undefined, 404);
  }

  await prisma.chatMember.delete({
    where: {
      chatId_userId: {
        chatId,
        userId: memberId,
      },
    },
  });

  const updatedChat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  return returnFormatter(
    true,
    chatMemberRemovedMessage,
    formatChatResponse(updatedChat!)
  );
}

async function getOwnedMessageRef(
  chatId: string,
  messageId: string,
  authUserId: string
): Promise<{
  messageRef: DocumentReference | null;
  error?: FormatterResult<never>;
}> {
  if (!messageId) {
    return {
      messageRef: null,
      error: returnFormatter(false, messageIdRequiredMessage, undefined, 400),
    };
  }

  const membershipCheck = await verifyChatMembership(chatId, authUserId);
  if (membershipCheck.error) {
    return { messageRef: null, error: membershipCheck.error };
  }

  const firestoreCheck = getFirestoreOrError();
  if (firestoreCheck.error || !firestoreCheck.db) {
    return { messageRef: null, error: firestoreCheck.error! };
  }

  const messageRef = firestoreCheck.db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .doc(messageId);

  const snapshot = await messageRef.get();
  if (!snapshot.exists) {
    return {
      messageRef: null,
      error: returnFormatter(false, messageNotFoundMessage, undefined, 404),
    };
  }

  const currentData = (snapshot.data() ?? {}) as Record<string, unknown>;
  if (currentData.isDeleted) {
    return {
      messageRef: null,
      error: returnFormatter(false, messageDeletedAlreadyMessage, undefined, 400),
    };
  }

  if (currentData.senderId !== authUserId) {
    return {
      messageRef: null,
      error: returnFormatter(false, messageOwnerOnlyMessage, undefined, 403),
    };
  }

  return { messageRef };
}

export async function editChatMessage(
  chatId: string,
  messageId: string,
  req: Request
): Promise<FormatterResult<MessageResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const text = editMessageFormatter(req);
  if (!text) {
    return returnFormatter(false, messageTextRequiredMessage, undefined, 400);
  }

  const ownedCheck = await getOwnedMessageRef(chatId, messageId, authUserId);
  if (ownedCheck.error || !ownedCheck.messageRef) {
    return ownedCheck.error!;
  }

  await ownedCheck.messageRef.update({
    text,
    isEdited: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await ownedCheck.messageRef.get();
  return returnFormatter(
    true,
    messageUpdatedSuccessMessage,
    formatMessageResponse(
      messageId,
      chatId,
      (updatedSnapshot.data() ?? {}) as Record<string, unknown>
    )
  );
}

export async function deleteChatMessage(
  chatId: string,
  messageId: string,
  req: Request
): Promise<FormatterResult<MessageResponse>> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return returnFormatter(false, unauthorizedMessage, undefined, 401);
  }

  const ownedCheck = await getOwnedMessageRef(chatId, messageId, authUserId);
  if (ownedCheck.error || !ownedCheck.messageRef) {
    return ownedCheck.error!;
  }

  await ownedCheck.messageRef.update({
    text: "",
    isDeleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnapshot = await ownedCheck.messageRef.get();
  return returnFormatter(
    true,
    messageDeletedSuccessMessage,
    formatMessageResponse(
      messageId,
      chatId,
      (updatedSnapshot.data() ?? {}) as Record<string, unknown>
    )
  );
}
