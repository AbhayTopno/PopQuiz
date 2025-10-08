import jwt from "jsonwebtoken";
import type { Response } from "express";

const generateToken = (res: Response, userId: string): string => {
  const secret = process.env.JWT_SECRET || "";
  const token: string = jwt.sign({ userId }, secret, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateToken;
