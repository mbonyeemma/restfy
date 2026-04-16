import { randomBytes, randomInt } from "crypto";
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import db from "../db";
import { ANONYMOUS_USER_ID } from "../config/constants";
import { register, login, authMiddleware, setAuthCookie, clearAuthCookie } from "../auth";
import { sendWelcomeEmail, sendPasswordResetEmail, sendSignupOtpEmail } from "../lib/email";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  const { email, password, name, otp } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    otp?: string;
  };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const normalized = email.trim().toLowerCase();
  const oneTimeCode = String(otp || "").trim();
  if (!/^\d{6}$/.test(oneTimeCode)) {
    res.status(400).json({ error: "A valid 6-digit OTP is required" });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const otpRow = db
    .prepare(
      "SELECT code_hash, attempts FROM registration_otp_tokens WHERE email = ? AND expires_at > ?"
    )
    .get(normalized, now) as { code_hash: string; attempts: number } | undefined;
  if (!otpRow) {
    res.status(400).json({ error: "OTP expired or not found. Request a new code." });
    return;
  }
  if (otpRow.attempts >= 5) {
    db.prepare("DELETE FROM registration_otp_tokens WHERE email = ?").run(normalized);
    res.status(429).json({ error: "Too many invalid OTP attempts. Request a new code." });
    return;
  }
  if (!bcrypt.compareSync(oneTimeCode, otpRow.code_hash)) {
    db.prepare(
      "UPDATE registration_otp_tokens SET attempts = attempts + 1 WHERE email = ?"
    ).run(normalized);
    res.status(400).json({ error: "Invalid OTP code" });
    return;
  }
  db.prepare("DELETE FROM registration_otp_tokens WHERE email = ?").run(normalized);

  const result = register(email, password, name);
  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  setAuthCookie(res, result.token);
  void sendWelcomeEmail(result.user.email, result.user.name).catch((err) =>
    console.error("[email] welcome:", err)
  );
  res.status(201).json(result);
});

router.post("/register/request-otp", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: string }
    | undefined;
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const otpCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  const hashed = bcrypt.hashSync(otpCode, 10);
  db.prepare("DELETE FROM registration_otp_tokens WHERE email = ?").run(normalized);
  db.prepare(
    "INSERT INTO registration_otp_tokens (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)"
  ).run(normalized, hashed, expiresAt);
  try {
    await sendSignupOtpEmail(normalized, otpCode);
  } catch (err) {
    console.error("[email] signup otp:", err);
  }
  res.json({ ok: true, message: "OTP sent. Check your email inbox." });
});

router.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const result = login(email, password);
  if ("error" in result) {
    res.status(401).json({ error: result.error });
    return;
  }
  setAuthCookie(res, result.token);
  res.json(result);
});

/** Clears cross-subdomain auth cookie (e.g. from restify.online promo). */
router.post("/logout", (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(204).send();
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  const user = db
    .prepare("SELECT id, email, name, created_at FROM users WHERE id = ?")
    .get(req.userId!) as { id: string; email: string; name: string; created_at: number } | undefined;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});

router.patch("/me", authMiddleware, (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (name !== undefined) {
    db.prepare("UPDATE users SET name = ?, updated_at = unixepoch() WHERE id = ?").run(
      name,
      req.userId!
    );
  }
  const user = db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(req.userId!) as { id: string; email: string; name: string };
  res.json({ user });
});

/**
 * Always responds with the same message so addresses can’t be enumerated.
 */
router.post("/forgot-password", (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  const msg = {
    ok: true,
    message: "If an account exists for that email, you will receive reset instructions shortly.",
  };
  res.json(msg);

  if (!email || typeof email !== "string") return;
  const normalized = email.trim().toLowerCase();
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: string }
    | undefined;
  if (!user || user.id === ANONYMOUS_USER_ID) return;

  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
  const token = randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  db.prepare(
    "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, user.id, expiresAt);

  void sendPasswordResetEmail(normalized, token).catch((err) =>
    console.error("[email] password reset:", err)
  );
});

router.post("/reset-password", (req: Request, res: Response) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const row = db
    .prepare(
      "SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > ?"
    )
    .get(token, now) as { user_id: string } | undefined;
  if (!row) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }
  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = unixepoch() WHERE id = ?").run(
    hashed,
    row.user_id
  );
  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(row.user_id);
  res.json({ ok: true });
});

router.post("/change-password", authMiddleware, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both passwords are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const user = db.prepare("SELECT password FROM users WHERE id = ?").get(req.userId!) as
    | { password: string }
    | undefined;
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = unixepoch() WHERE id = ?").run(
    hashed,
    req.userId!
  );
  res.json({ ok: true });
});

export default router;
