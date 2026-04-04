import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import db from "../db";
import { register, login, authMiddleware } from "../auth";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const result = register(email, password, name);
  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  res.status(201).json(result);
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
  res.json(result);
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
