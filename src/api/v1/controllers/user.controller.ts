import { Request, Response } from "express";
import {
  badRequest,
  forbidden,
  notFound,
  success,
  unauthorized,
  unknownError,
} from "../helpers/response.helper.js";
import {
  deleteUserById,
  getUserDetails,
  getUsersList,
  updateUserById,
} from "../helpers/user.helper.js";
import { userIdRequiredMessage } from "../constants/messageConstants.js";

function extractUserId(req: Request): string | null {
  const rawId = req.params.id;
  const userId = Array.isArray(rawId) ? rawId[0] : rawId;
  return userId && userId.trim() !== "" ? userId.trim() : null;
}

function handleFailureResponse(
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
    default:
      return badRequest(res, message);
  }
}

export async function getAllUsers(req: Request, res: Response): Promise<Response> {
  try {
    const { status, message, data, statusCode } = await getUsersList(req);
    return status
      ? success(res, message, data)
      : handleFailureResponse(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function getUserById(req: Request, res: Response): Promise<Response> {
  try {
    const userId = extractUserId(req);
    if (!userId) {
      return badRequest(res, userIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await getUserDetails(userId);
    return status
      ? success(res, message, data)
      : handleFailureResponse(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function updateUser(req: Request, res: Response): Promise<Response> {
  try {
    const userId = extractUserId(req);
    if (!userId) {
      return badRequest(res, userIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await updateUserById(
      userId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailureResponse(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function deleteUser(req: Request, res: Response): Promise<Response> {
  try {
    const userId = extractUserId(req);
    if (!userId) {
      return badRequest(res, userIdRequiredMessage);
    }

    const { status, message, data, statusCode } = await deleteUserById(
      userId,
      req
    );
    return status
      ? success(res, message, data)
      : handleFailureResponse(res, message, statusCode);
  } catch (error) {
    return unknownError(res, error);
  }
}
