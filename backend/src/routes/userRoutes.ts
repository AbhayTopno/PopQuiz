import express from "express";
import {
  getAllUsers,
  getUserById,
  login,
  logout,
  signup,
} from "../controllers/auth.controller.ts";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/getUser/:id", getUserById);
router.get("/getAllUsers", getAllUsers);

export default router;
