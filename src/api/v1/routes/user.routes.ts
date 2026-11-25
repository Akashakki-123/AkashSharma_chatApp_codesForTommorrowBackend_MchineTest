import { Router } from "express";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser,
} from "../controllers/user.controller.js";
import { listUserChats } from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get("/", getAllUsers);
userRoutes.get("/:userId/chats", listUserChats);
userRoutes.get("/:id", getUserById);
userRoutes.patch("/:id", updateUser);
userRoutes.delete("/:id", deleteUser);

export default userRoutes;
