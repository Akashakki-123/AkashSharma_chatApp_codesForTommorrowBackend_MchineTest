import { Request, Response } from "express";
import {
  badRequest,
  created,
  success,
  unauthorized,
  unknownError,
} from "../helpers/response.helper.js";
import { loginUser, signupUser } from "../helpers/auth.helper.js";

export async function signup(req: Request, res: Response): Promise<Response> {
  try {
    const { status, message, data } = await signupUser(req);
    return status ? created(res, message, data) : badRequest(res, message);
  } catch (error) {
    return unknownError(res, error);
  }
}

export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { status, message, data, statusCode } = await loginUser(req);
    if (status) {
      return success(res, message, data);
    }
    return statusCode === 401
      ? unauthorized(res, message)
      : badRequest(res, message);
  } catch (error) {
    return unknownError(res, error);
  }
}
