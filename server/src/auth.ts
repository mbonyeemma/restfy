import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type { Request, Response, NextFunction } from "express";
import db from "./db";
import { JWT_EXPIRES, JWT_SECRET } from "./config/constants";

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}

export function register(
  email: string,
  password: string,
  name?: string
): { user: { id: string; email: string; name: string }; token: string } | { error: string } {
  const normalized = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: string }
    | undefined;
  if (existing) return { error: "Email already registered" };

  const id = uuid();
  const hashed = hashPassword(password);
  db.prepare("INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)").run(
    id,
    normalized,
    name || "",
    hashed
  );

  db.prepare("INSERT INTO global_vars (user_id, data) VALUES (?, ?)").run(id, "[]");

  const token = generateToken(id);
  return { user: { id, email: normalized, name: name || "" }, token };
}

export function login(
  email: string,
  password: string
): { user: { id: string; email: string; name: string }; token: string } | { error: string } {
  const normalized = email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as
    | { id: string; email: string; name: string; password: string }
    | undefined;
  if (!user) return { error: "Invalid email or password" };
  if (!verifyPassword(password, user.password))
    return { error: "Invalid email or password" };

  const token = generateToken(user.id);
  return { user: { id: user.id, email: user.email, name: user.name }, token };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    const sub = payload.sub;
    if (typeof sub !== "string") {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
