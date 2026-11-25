import { UserRole } from "@prisma/client";

export interface JwtUserPayload {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  status: boolean;
  subCode: number;
  message: string;
  error?: unknown;
  items?: T;
  tokenInfo?: unknown;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface UserPublic {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSuccessData {
  token: string;
  user: UserPublic;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedUsersResponse {
  users: UserPublic[];
  pagination: PaginationMeta;
}

export interface CreateDirectChatInput {
  userAId: string;
  userBId: string;
}

export interface CreateGroupChatInput {
  name: string;
  memberIds: string[];
}

export interface SendMessageInput {
  senderId: string;
  text: string;
}

export interface MarkMessageReadInput {
  userId: string;
}

export interface UpdateLastSeenInput {
  userId: string;
  messageId: string;
}

export interface ChatResponse {
  chatId: string;
  isGroup: boolean;
  name: string | null;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
  isNew?: boolean;
}

export interface MessageResponse {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: Record<string, string>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LastSeenResponse {
  chatId: string;
  userId: string;
  messageId: string;
  updatedAt: string | null;
}
