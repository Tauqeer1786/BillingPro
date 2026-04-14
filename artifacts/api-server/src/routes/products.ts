import { Router, type IRouter } from "express";
import { eq, like, sql, desc } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, page = 1, limit = 50 } = params.data;
  const offset = (page - 1) * limit;

  let query = db.select().from(productsTable);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(productsTable);

  if (search) {
    const searchCondition = like(productsTable.name, `%${search}%`);
    query = query.where(searchCondition) as typeof query;
    countQuery = countQuery.where(searchCondition) as typeof countQuery;
  }

  const [products, [{ count: total }]] = await Promise.all([
    query.orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  res.json({
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      costPrice: p.costPrice,
      marginPercent: p.marginPercent,
      sellingPrice: p.sellingPrice,
      gstPercent: p.gstPercent,
      stock: p.stock,
      hsn: p.hsn,
      unit: p.unit,
      createdAt: p.createdAt.toISOString(),
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { costPrice, marginPercent, ...rest } = parsed.data;
  const sellingPrice = costPrice * (1 + marginPercent / 100);

  const [product] = await db.insert(productsTable).values({
    ...rest,
    costPrice,
    marginPercent,
    sellingPrice: Math.round(sellingPrice * 100) / 100,
  }).returning();

  res.status(201).json({
    ...product,
    createdAt: product.createdAt.toISOString(),
  });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    ...product,
    createdAt: product.createdAt.toISOString(),
  });
});

router.put("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.costPrice != null || parsed.data.marginPercent != null) {
    const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const cost = parsed.data.costPrice ?? existing.costPrice;
    const margin = parsed.data.marginPercent ?? existing.marginPercent;
    updateData.sellingPrice = Math.round(cost * (1 + margin / 100) * 100) / 100;
  }

  const [product] = await db.update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({
    ...product,
    createdAt: product.createdAt.toISOString(),
  });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ success: true, message: "Product deleted" });
});

export default router;
