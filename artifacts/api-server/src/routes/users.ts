import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, salesmanPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireMaster, requireAdminOrMaster } from "../middleware/auth";

const router: IRouter = Router();

router.get("/users", authenticate, requireAdminOrMaster, async (req, res): Promise<void> => {
  const allUsers = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
    createdBy: usersTable.createdBy,
  }).from(usersTable);

  const users = req.user!.role === "master"
    ? allUsers.filter(u => u.id !== req.user!.id)
    : allUsers.filter(u => u.role !== "master");

  const perms = await db.select().from(salesmanPermissionsTable);

  const result = users.map(u => ({
    ...u,
    permissions: perms.find(p => p.userId === u.id) || null,
  }));

  res.json(result);
});

router.post("/users", authenticate, requireMaster, async (req, res): Promise<void> => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    res.status(400).json({ error: "Username, password, and role are required" });
    return;
  }
  if (!["admin", "salesman"].includes(role)) {
    res.status(400).json({ error: "Role must be admin or salesman" });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(usersTable).values({
    username,
    passwordHash,
    role: role as "admin" | "salesman",
    isActive: true,
    createdBy: req.user!.id,
  }).returning();

  if (role === "salesman") {
    await db.insert(salesmanPermissionsTable).values({
      userId: newUser.id,
      canAccessDashboard: false,
      canBill: true,
      canViewReports: false,
      canEditInvoices: false,
      canAccessInventory: false,
    });
  }

  res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role });
});

router.put("/users/:id", authenticate, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id);
  const currentUser = req.user!;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (currentUser.role === "master") {
    const { username, isActive } = req.body;
    if (username !== undefined) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
      if (existing.length > 0 && existing[0].id !== targetId) {
        res.status(409).json({ error: "Username already exists" });
        return;
      }
      await db.update(usersTable).set({ username }).where(eq(usersTable.id, targetId));
    }
    if (isActive !== undefined) {
      await db.update(usersTable).set({ isActive }).where(eq(usersTable.id, targetId));
    }
  } else if (currentUser.role === "admin" && target.role === "salesman") {
    const { permissions } = req.body;
    if (permissions) {
      await db.update(salesmanPermissionsTable).set({
        canAccessDashboard: permissions.canAccessDashboard ?? false,
        canBill: permissions.canBill ?? true,
        canViewReports: permissions.canViewReports ?? false,
        canEditInvoices: permissions.canEditInvoices ?? false,
        canAccessInventory: permissions.canAccessInventory ?? false,
      }).where(eq(salesmanPermissionsTable.userId, targetId));
    }
  } else {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  res.json({ success: true });
});

router.delete("/users/:id", authenticate, requireMaster, async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === "master") {
    res.status(400).json({ error: "Cannot delete master account" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  res.json({ success: true });
});

export default router;
