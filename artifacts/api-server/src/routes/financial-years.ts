import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, invoicesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/financial-years", async (_req, res): Promise<void> => {
  const results = await db.select({
    minDate: sql<string>`min(${invoicesTable.date})`,
    maxDate: sql<string>`max(${invoicesTable.date})`,
  }).from(invoicesTable);

  const financialYears: { label: string; startDate: string; endDate: string }[] = [];

  if (results[0].minDate && results[0].maxDate) {
    const minDate = new Date(results[0].minDate);
    const maxDate = new Date(results[0].maxDate);

    let startYear = minDate.getMonth() >= 3 ? minDate.getFullYear() : minDate.getFullYear() - 1;
    const endYear = maxDate.getMonth() >= 3 ? maxDate.getFullYear() : maxDate.getFullYear() - 1;

    for (let y = startYear; y <= endYear; y++) {
      financialYears.push({
        label: `${y}-${y + 1}`,
        startDate: `${y}-04-01`,
        endDate: `${y + 1}-03-31`,
      });
    }
  }

  if (financialYears.length === 0) {
    const now = new Date();
    const currentFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    financialYears.push({
      label: `${currentFY}-${currentFY + 1}`,
      startDate: `${currentFY}-04-01`,
      endDate: `${currentFY + 1}-03-31`,
    });
  }

  res.json(financialYears);
});

export default router;
