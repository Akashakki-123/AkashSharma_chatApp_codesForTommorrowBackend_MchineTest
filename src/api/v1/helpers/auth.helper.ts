import { Request } from "express";
import { UserRole } from "@prisma/client";
import prisma from "../config/db.js";
import { returnFormatter, FormatterResult } from "../formatters/common.formatter.js";
import {
  formatUserResponse,
  isValidEmail,
  userCreateFormatter,
  userLoginFormatter,
} from "../formatters/user.formatter.js";
import { comparePassword, hashPassword } from "../utils/encrypt.js";
import { generateToken } from "../utils/jwt.js";
import { AuthSuccessData } from "../types/index.js";
import {
  emailAlreadyRegisteredMessage,
  emailPasswordRequiredMessage,
  invalidCredentialsMessage,
  invalidEmailFormatMessage,
  loginSuccessMessage,
  passwordMinLengthMessage,
  signupRequiredFieldsMessage,
  signupSuccessMessage,
} from "../constants/messageConstants.js";

const MIN_PASSWORD_LENGTH = 6;

export async function signupUser(
  req: Request
): Promise<FormatterResult<AuthSuccessData>> {
  const formattedData = userCreateFormatter(req);

  if (
    !formattedData.fullName ||
    !formattedData.email ||
    !formattedData.phone ||
    !formattedData.password
  ) {
    return returnFormatter(false, signupRequiredFieldsMessage);
  }

  if (!isValidEmail(formattedData.email)) {
    return returnFormatter(false, invalidEmailFormatMessage);
  }

  if (formattedData.password.length < MIN_PASSWORD_LENGTH) {
    return returnFormatter(false, passwordMinLengthMessage);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: formattedData.email },
  });

  if (existingUser) {
    return returnFormatter(false, emailAlreadyRegisteredMessage);
  }

  const hashedPassword = await hashPassword(formattedData.password);

  const newUser = await prisma.user.create({
    data: {
      fullName: formattedData.fullName,
      email: formattedData.email,
      phone: formattedData.phone,
      password: hashedPassword,
      role: UserRole.USER,
    },
  });

  const token = generateToken({
    id: newUser.id,
    role: newUser.role,
    email: newUser.email,
    fullName: newUser.fullName,
  });

  return returnFormatter(true, signupSuccessMessage, {
    token,
    user: formatUserResponse(newUser),
  });
}

export async function loginUser(
  req: Request
): Promise<FormatterResult<AuthSuccessData>> {
  const { email, password } = userLoginFormatter(req);

  if (!email || !password) {
    return returnFormatter(false, emailPasswordRequiredMessage);
  }

  if (!isValidEmail(email)) {
    return returnFormatter(false, invalidEmailFormatMessage);
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      isDeleted: false,
    },
  });

  if (!user) {
    return returnFormatter(false, invalidCredentialsMessage, undefined, 401);
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    return returnFormatter(false, invalidCredentialsMessage, undefined, 401);
  }

  const token = generateToken({
    id: user.id,
    role: user.role,
    email: user.email,
    fullName: user.fullName,
  });

  return returnFormatter(true, loginSuccessMessage, {
    token,
    user: formatUserResponse(user),
  });
}
