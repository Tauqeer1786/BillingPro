import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, salesmanPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, JWT_SECRET, type AuthUser } from "../middleware/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  let permissions = null;
  if (user.role === "salesman") {
    const [perms] = await db.select().from(salesmanPermissionsTable).where(eq(salesmanPermissionsTable.userId, user.id));
    permissions = perms || null;
  }

  const payload: AuthUser = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions,
    },
  });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found or inactive" });
    return;
  }

  let permissions = null;
  if (user.role === "salesman") {
    const [perms] = await db.select().from(salesmanPermissionsTable).where(eq(salesmanPermissionsTable.userId, user.id));
    permissions = perms || null;
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    permissions,
  });
});

router.post("/auth/change-password", authenticate, async (req, res): Promise<void> => {
  const { currentPassword, newPassword, targetUserId } = req.body;
  const currentUser = req.user!;

  if (targetUserId && targetUserId !== currentUser.id) {
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (currentUser.role === "master") {
    } else if (currentUser.role === "admin" && targetUser.role === "salesman") {
    } else {
      res.status(403).json({ error: "Insufficient permissions to reset this user's password" });
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      res.status(400).json({ error: "New password must be at least 4 characters" });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, targetUserId));
    res.json({ success: true });
    return;
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "New password must be at least 4 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, currentUser.id));
  res.json({ success: true });
});

export default router;
