import { Request } from "express";
import { User } from "@prisma/client";
import {
  CreateUserInput,
  LoginInput,
  UpdateUserInput,
  UserPublic,
} from "../types/index.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id.trim());
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function userCreateFormatter(req: Request): CreateUserInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    fullName: typeof body.fullName === "string" ? body.fullName.trim() : "",
    email: typeof body.email === "string" ? body.email.toLowerCase().trim() : "",
    phone: typeof body.phone === "string" ? body.phone.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
}

export function userLoginFormatter(req: Request): LoginInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return {
    email: typeof body.email === "string" ? body.email.toLowerCase().trim() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
}

export function userUpdateFormatter(req: Request): UpdateUserInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const formatted: UpdateUserInput = {};

  if (typeof body.fullName === "string" && body.fullName.trim() !== "") {
    formatted.fullName = body.fullName.trim();
  }
  if (typeof body.email === "string" && body.email.trim() !== "") {
    formatted.email = body.email.toLowerCase().trim();
  }
  if (typeof body.phone === "string" && body.phone.trim() !== "") {
    formatted.phone = body.phone.trim();
  }
  if (typeof body.password === "string" && body.password !== "") {
    formatted.password = body.password;
  }

  return formatted;
}

export function formatUserResponse(user: User): UserPublic {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
