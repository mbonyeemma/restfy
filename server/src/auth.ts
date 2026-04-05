import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import type { Request, Response, NextFunction } from "express";
import db from "./db";
import {
  AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_NAME,
  JWT_EXPIRES,
  JWT_SECRET,
} from "./config/constants";

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

const COOKIE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string): void {
  if (!AUTH_COOKIE_DOMAIN) return;
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    domain: AUTH_COOKIE_DOMAIN,
    maxAge: COOKIE_MAX_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  if (!AUTH_COOKIE_DOMAIN) return;
  res.clearCookie(AUTH_COOKIE_NAME, {
    domain: AUTH_COOKIE_DOMAIN,
    path: "/",
  });
}

function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  const c = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof c === "string" && c.length > 0) return c;
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = verifyToken(token);
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
