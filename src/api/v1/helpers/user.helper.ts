import { Request } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db.js";
import { returnFormatter, FormatterResult } from "../formatters/common.formatter.js";
import {
  formatUserResponse,
  isValidEmail,
  isValidUuid,
  userUpdateFormatter,
} from "../formatters/user.formatter.js";
import { hashPassword } from "../utils/encrypt.js";
import { PaginatedUsersResponse, UserPublic } from "../types/index.js";
import {
  emailAlreadyRegisteredMessage,
  invalidEmailFormatMessage,
  invalidUserIdMessage,
  noUpdateFieldsMessage,
  passwordMinLengthMessage,
  userAccessDeniedMessage,
  userDeleteSuccessMessage,
  userDetailsSuccessMessage,
  userNotFoundMessage,
  usersListSuccessMessage,
  userUpdateSuccessMessage,
} from "../constants/messageConstants.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MIN_PASSWORD_LENGTH = 6;

function canModifyUser(req: Request, targetUserId: string): boolean {
  return req.user?.role === "ADMIN" || req.user?.id === targetUserId;
}

export async function getUsersList(
  req: Request
): Promise<FormatterResult<PaginatedUsersResponse>> {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  const whereClause: Prisma.UserWhereInput = {
    isDeleted: false,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return returnFormatter(true, usersListSuccessMessage, {
    users: users.map(formatUserResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function getUserDetails(
  userId: string
): Promise<FormatterResult<UserPublic>> {
  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
  });

  if (!user) {
    return returnFormatter(false, userNotFoundMessage, undefined, 404);
  }

  return returnFormatter(true, userDetailsSuccessMessage, formatUserResponse(user));
}

export async function updateUserById(
  userId: string,
  req: Request
): Promise<FormatterResult<UserPublic>> {
  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (!canModifyUser(req, userId)) {
    return returnFormatter(false, userAccessDeniedMessage, undefined, 403);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
  });

  if (!existingUser) {
    return returnFormatter(false, userNotFoundMessage, undefined, 404);
  }

  const updateInput = userUpdateFormatter(req);
  if (Object.keys(updateInput).length === 0) {
    return returnFormatter(false, noUpdateFieldsMessage, undefined, 400);
  }

  if (updateInput.email) {
    if (!isValidEmail(updateInput.email)) {
      return returnFormatter(false, invalidEmailFormatMessage, undefined, 400);
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email: updateInput.email },
    });

    if (emailOwner && emailOwner.id !== userId) {
      return returnFormatter(false, emailAlreadyRegisteredMessage, undefined, 400);
    }
  }

  const dataToUpdate: Prisma.UserUpdateInput = {
    ...(updateInput.fullName !== undefined ? { fullName: updateInput.fullName } : {}),
    ...(updateInput.email !== undefined ? { email: updateInput.email } : {}),
    ...(updateInput.phone !== undefined ? { phone: updateInput.phone } : {}),
  };

  if (updateInput.password !== undefined) {
    if (updateInput.password.length < MIN_PASSWORD_LENGTH) {
      return returnFormatter(false, passwordMinLengthMessage, undefined, 400);
    }
    dataToUpdate.password = await hashPassword(updateInput.password);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  return returnFormatter(
    true,
    userUpdateSuccessMessage,
    formatUserResponse(updatedUser)
  );
}

export async function deleteUserById(
  userId: string,
  req: Request
): Promise<FormatterResult<UserPublic>> {
  if (!isValidUuid(userId)) {
    return returnFormatter(false, invalidUserIdMessage, undefined, 400);
  }

  if (!canModifyUser(req, userId)) {
    return returnFormatter(false, userAccessDeniedMessage, undefined, 403);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      isDeleted: false,
    },
  });

  if (!existingUser) {
    return returnFormatter(false, userNotFoundMessage, undefined, 404);
  }

  const deletedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  return returnFormatter(
    true,
    userDeleteSuccessMessage,
    formatUserResponse(deletedUser)
  );
}
