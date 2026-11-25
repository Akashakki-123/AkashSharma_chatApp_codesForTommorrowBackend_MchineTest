import { Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiResponse } from "../types/index.js";
import {
  badRequestMessage,
  createdMessage,
  duplicateEntryMessage,
  errorMessage,
  forbiddenMessage,
  internalServerErrorMessage,
  invalidReferenceMessage,
  invalidRequestMessage,
  invalidTokenMessage,
  notFoundMessage,
  rateLimitExceededMessage,
  serviceUnavailableMessage,
  somethingWentWrongMessage,
  successMessage,
  tokenExpiredMessage,
  unauthorizedMessage,
  validationErrorMessage,
  validationFailedMessage,
} from "../constants/messageConstants.js";

export function sendResponse<T = unknown>(
  res: Response,
  statusCode: number,
  status: boolean,
  message: string,
  error: unknown = "",
  items?: T
): Response {
  const response: ApiResponse<T> = {
    status,
    subCode: statusCode,
    message,
    error: error ?? "",
    items: items ?? ({} as T),
  };

  const extendedRes = res as unknown as { tokenInfo?: unknown };
  if (extendedRes.tokenInfo) {
    response.tokenInfo = extendedRes.tokenInfo;
  }

  return res.status(statusCode).json(response);
}

export function success<T = unknown>(
  res: Response,
  message: string = successMessage,
  items?: T
): Response {
  return sendResponse(res, 200, true, message, "", items);
}

export function created<T = unknown>(
  res: Response,
  message: string = createdMessage,
  items?: T
): Response {
  return sendResponse(res, 201, true, message, "", items);
}

export function notFound(
  res: Response,
  message: string = notFoundMessage
): Response {
  return sendResponse(res, 404, false, message, "", {});
}

export function badRequest(
  res: Response,
  message: string = badRequestMessage,
  error: unknown = ""
): Response {
  return sendResponse(res, 400, false, message, error, undefined);
}

export function unauthorized(
  res: Response,
  message: string = unauthorizedMessage,
  error: unknown = ""
): Response {
  return sendResponse(res, 401, false, message, error, {});
}

export function forbidden(
  res: Response,
  message: string = forbiddenMessage,
  error: unknown = ""
): Response {
  return sendResponse(res, 403, false, message, error, {});
}

export function tooManyRequests(
  res: Response,
  message: string = rateLimitExceededMessage
): Response {
  return sendResponse(res, 429, false, message, "TooManyRequestsError", {});
}

export function serviceUnavailable(
  res: Response,
  message: string = serviceUnavailableMessage,
  error: unknown = "ServiceUnavailableError"
): Response {
  return sendResponse(res, 503, false, message, error, {});
}

export function invalid<T = unknown>(
  res: Response,
  message: string = invalidRequestMessage,
  items?: T
): Response {
  return sendResponse(res, 301, false, message, "", items);
}

export function onError(
  res: Response,
  message: string = errorMessage,
  error: unknown = null
): Response {
  return sendResponse(res, 400, false, message, error, null);
}

export function alreadyExist(keys: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  keys.forEach((key) => {
    errors[key] = `${key} already exists`;
  });
  return errors;
}

export function serverValidation(
  res: Response,
  error: { errors: Array<{ param: string; msg: string }> }
): Response {
  const responseErrors: Record<string, string> = {};
  error.errors.forEach((err) => {
    responseErrors[err.param] = err.msg;
  });
  return sendResponse(
    res,
    400,
    false,
    validationFailedMessage,
    "ValidationError",
    responseErrors
  );
}

export function unknownError(res: Response, error: unknown): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[])
        : ["field"];
      return sendResponse(
        res,
        400,
        false,
        duplicateEntryMessage,
        "DuplicateKeyError",
        alreadyExist(target)
      );
    }

    if (error.code === "P2025") {
      return sendResponse(res, 404, false, notFoundMessage, "NotFoundError", {});
    }

    if (error.code === "P2003") {
      return sendResponse(
        res,
        400,
        false,
        invalidReferenceMessage,
        "ForeignKeyConstraintError",
        {}
      );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return sendResponse(
      res,
      400,
      false,
      validationErrorMessage,
      "ValidationError",
      {}
    );
  }

  const errObject = error as {
    name?: string;
    message?: string;
    statusCode?: number;
  };

  if (errObject?.name === "JsonWebTokenError") {
    return sendResponse(
      res,
      401,
      false,
      invalidTokenMessage,
      "JsonWebTokenError",
      errObject.message || invalidTokenMessage
    );
  }

  if (errObject?.name === "TokenExpiredError") {
    return sendResponse(
      res,
      401,
      false,
      tokenExpiredMessage,
      "TokenExpiredError",
      errObject.message || tokenExpiredMessage
    );
  }

  if (
    typeof errObject?.statusCode === "number" &&
    errObject.statusCode >= 400 &&
    errObject.statusCode < 600
  ) {
    return sendResponse(
      res,
      errObject.statusCode,
      false,
      errObject.message || invalidRequestMessage,
      errObject.name || "HttpError",
      {}
    );
  }

  if (error instanceof Error) {
    return sendResponse(
      res,
      500,
      false,
      error.message || somethingWentWrongMessage,
      error.name,
      undefined
    );
  }

  return sendResponse(
    res,
    500,
    false,
    somethingWentWrongMessage,
    internalServerErrorMessage,
    undefined
  );
}
