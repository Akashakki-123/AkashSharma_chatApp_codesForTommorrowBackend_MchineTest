import { Router } from "express";
import {
  addMembersToGroup,
  createChat,
  createGroup,
  deleteMessage,
  editMessage,
  getMessages,
  markMessageRead,
  removeMemberFromGroup,
  sendMessage,
  updateLastSeen,
} from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const chatRoutes = Router();

chatRoutes.use(authenticate);

// Core Chat & Messaging APIs
chatRoutes.post("/create", createChat);
chatRoutes.post("/:chatId/message/send", sendMessage);
chatRoutes.get("/:chatId/messages", getMessages);
chatRoutes.post("/:chatId/message/:messageId/read", markMessageRead);
chatRoutes.post("/:chatId/lastseen", updateLastSeen);

// Bonus: Group Chat Management & Message Edit/Delete
chatRoutes.post("/group", createGroup);
chatRoutes.post("/:chatId/members", addMembersToGroup);
chatRoutes.delete("/:chatId/members/:memberId", removeMemberFromGroup);
chatRoutes.patch("/:chatId/message/:messageId", editMessage);
chatRoutes.delete("/:chatId/message/:messageId", deleteMessage);

export default chatRoutes;
