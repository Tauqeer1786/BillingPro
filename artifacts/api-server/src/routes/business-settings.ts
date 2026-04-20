import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { businessSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireMaster, requireAdminOrMaster } from "../middleware/auth";

const router: IRouter = Router();

const MASTER_ONLY_KEYS = ["businessName", "gstin", "fssaiNumber", "settingsLocked"];
const ADMIN_KEYS = ["phone", "address", "email"];

router.get("/business-settings", authenticate, async (_req, res): Promise<void> => {
  const rows = await db.select().from(businessSettingsTable);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

router.get("/business-settings/lock-status", authenticate, async (_req, res): Promise<void> => {
  const [row] = await db.select().from(businessSettingsTable).where(eq(businessSettingsTable.key, "settingsLocked"));
  res.json({ locked: row?.value === "true" });
});

router.put("/business-settings", authenticate, async (req, res): Promise<void> => {
  const currentUser = req.user!;
  const updates: Record<string, string> = req.body;

  const [lockRow] = await db.select().from(businessSettingsTable).where(eq(businessSettingsTable.key, "settingsLocked"));
  const isLocked = lockRow?.value === "true";

  for (const key of Object.keys(updates)) {
    if (MASTER_ONLY_KEYS.includes(key)) {
      if (currentUser.role !== "master") {
        res.status(403).json({ error: `Only Master can modify '${key}'` });
        return;
      }
      if (isLocked && key !== "settingsLocked") {
        res.status(403).json({ error: "Business settings are locked" });
        return;
      }
    } else if (ADMIN_KEYS.includes(key)) {
      if (currentUser.role === "salesman") {
        res.status(403).json({ error: `Salesmen cannot modify '${key}'` });
        return;
      }
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await db.insert(businessSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: businessSettingsTable.key, set: { value } });
  }

  res.json({ success: true });
});

router.post("/business-settings/toggle-lock", authenticate, requireMaster, async (_req, res): Promise<void> => {
  const [row] = await db.select().from(businessSettingsTable).where(eq(businessSettingsTable.key, "settingsLocked"));
  const currentlyLocked = row?.value === "true";
  const newValue = currentlyLocked ? "false" : "true";

  await db.insert(businessSettingsTable)
    .values({ key: "settingsLocked", value: newValue })
    .onConflictDoUpdate({ target: businessSettingsTable.key, set: { value: newValue } });

  res.json({ locked: newValue === "true" });
});

export default router;
