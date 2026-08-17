// @ts-nocheck
import express from "express";
import { db, productsTable, productReviewsTable, productPurchasesTable, productDeliveryUnitsTable, usersTable, messagesTable } from "@workspace/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = express.Router();

// ── List products ──
router.get("/products", async (_req, res) => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));

  const reviews = await db.select().from(productReviewsTable);
  const stats = new Map();
  for (const r of reviews) {
    const s = stats.get(r.productId) || { count: 0, total: 0 };
    s.count += 1;
    s.total += r.rating;
    stats.set(r.productId, s);
  }

  const result = products.map((p) => {
    const s = stats.get(p.id);
    return {
      ...p,
      reviewsCount: s?.count ?? 0,
      avgRating: s ? +(s.total / s.count).toFixed(1) : 0,
    };
  });

  res.json(result);
});

// ── Get single product with reviews + purchase status + delivery units ──
router.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.session?.userId ?? null;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      rating: productReviewsTable.rating,
      comment: productReviewsTable.comment,
      createdAt: productReviewsTable.createdAt,
      userId: productReviewsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(productReviewsTable)
    .leftJoin(usersTable, eq(productReviewsTable.userId, usersTable.id))
    .where(eq(productReviewsTable.productId, id))
    .orderBy(desc(productReviewsTable.createdAt));

  const avgRating = reviews.length ? +(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

  // Check if user has purchased this product
  let hasPurchased = false;
  let deliveredUnits = [];
  if (userId) {
    const [purchase] = await db
      .select()
      .from(productPurchasesTable)
      .where(and(eq(productPurchasesTable.productId, id), eq(productPurchasesTable.userId, userId)))
      .limit(1);
    hasPurchased = !!purchase;

    if (hasPurchased) {
      deliveredUnits = await db
        .select()
        .from(productDeliveryUnitsTable)
        .where(and(eq(productDeliveryUnitsTable.productId, id), eq(productDeliveryUnitsTable.userId, userId)))
        .orderBy(desc(productDeliveryUnitsTable.createdAt));
    }
  }

  res.json({
    ...product,
    reviews,
    reviewsCount: reviews.length,
    avgRating,
    hasPurchased,
    deliveredUnits,
  });
});

// ── Create product (admin only) ──
router.post("/products", requireAdmin, async (req, res) => {
  const { title, description, imageUrl, imageDetailUrl, price, stock, deliveryContents, paymentMode } = req.body;
  const creatorId = req.session.userId;

  if (!title?.trim() || !description?.trim() || !price || price <= 0) {
    res.status(400).json({ error: "Title, description, and price are required" });
    return;
  }

  const { priceUsd, buyUrl } = req.body as { priceUsd?: string; buyUrl?: string };

  const [product] = await db
    .insert(productsTable)
    .values({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl?.trim() || null,
      imageDetailUrl: imageDetailUrl?.trim() || null,
      price: Math.max(1, price),
      priceUsd: priceUsd?.trim() || null,
      buyUrl: buyUrl?.trim() || null,
      paymentMode: paymentMode || "both",
      stock: Math.max(0, stock ?? 0),
      createdBy: creatorId,
    })
    .returning();

  // Insert delivery units if provided
  if (Array.isArray(deliveryContents) && deliveryContents.length > 0) {
    const units = deliveryContents
      .filter((c) => c?.trim())
      .map((content) => ({
        productId: product.id,
        content: content.trim(),
      }));
    if (units.length > 0) {
      await db.insert(productDeliveryUnitsTable).values(units);
    }
  }

  res.status(201).json(product);
});

// ── Add stock (admin only) ──
router.patch("/products/:id/stock", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({ stock: product.stock + amount })
    .where(eq(productsTable.id, id))
    .returning();

  res.json(updated);
});

// ── Add delivery units (admin only) ──
router.post("/products/:id/units", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { contents } = req.body;

  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ error: "contents array is required" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const units = contents
    .filter((c) => c?.trim())
    .map((content) => ({
      productId: id,
      content: content.trim(),
    }));

  if (units.length === 0) {
    res.status(400).json({ error: "No valid delivery contents provided" });
    return;
  }

  await db.insert(productDeliveryUnitsTable).values(units);

  // Also increase stock by the number of units added
  await db
    .update(productsTable)
    .set({ stock: product.stock + units.length })
    .where(eq(productsTable.id, id));

  res.json({ added: units.length, productId: id });
});

// ── Get delivery units (admin only) ──
router.get("/products/:id/units", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const units = await db
    .select()
    .from(productDeliveryUnitsTable)
    .where(eq(productDeliveryUnitsTable.productId, id))
    .orderBy(productDeliveryUnitsTable.id);

  res.json(units);
});

// ── Update product (admin only) ──
router.patch("/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, imageUrl, price, priceUsd, buyUrl, stock } = req.body;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const { imageDetailUrl, paymentMode } = req.body;

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (imageUrl !== undefined) updates.imageUrl = imageUrl?.trim() || null;
  if (imageDetailUrl !== undefined) updates.imageDetailUrl = imageDetailUrl?.trim() || null;
  if (price !== undefined) updates.price = Math.max(1, price);
  if (priceUsd !== undefined) updates.priceUsd = priceUsd?.trim() || null;
  if (buyUrl !== undefined) updates.buyUrl = buyUrl?.trim() || null;
  if (paymentMode !== undefined) updates.paymentMode = paymentMode;
  if (stock !== undefined) updates.stock = Math.max(0, stock);

  const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  res.json(updated);
});

// ── Delete product (admin only) ──
router.delete("/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// ── Add review (auth, only if purchased) ──
router.post("/products/:id/reviews", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Check if user has purchased
  const [purchase] = await db
    .select()
    .from(productPurchasesTable)
    .where(and(eq(productPurchasesTable.productId, productId), eq(productPurchasesTable.userId, userId)))
    .limit(1);

  if (!purchase) {
    res.status(403).json({ error: "You can only review products you have purchased" });
    return;
  }

  // Check if user already reviewed
  const [existing] = await db
    .select()
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, productId), eq(productReviewsTable.userId, userId)))
    .limit(1);

  if (existing) {
    res.status(400).json({ error: "You already reviewed this product" });
    return;
  }

  const [review] = await db
    .insert(productReviewsTable)
    .values({
      productId,
      userId,
      rating,
      comment: comment?.trim() || null,
    })
    .returning();

  res.status(201).json(review);
});

// ── Buy product (auth) ──
router.post("/products/:id/buy", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const { quantity = 1 } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (product.stock < qty) {
    res.status(400).json({ error: "Not enough stock" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const totalPrice = product.price * qty;
  if ((user?.points ?? 0) < totalPrice) {
    res.status(400).json({ error: "Not enough points" });
    return;
  }

  // Check available undelivered units
  const availableUnits = await db
    .select()
    .from(productDeliveryUnitsTable)
    .where(and(
      eq(productDeliveryUnitsTable.productId, productId),
      eq(productDeliveryUnitsTable.isDelivered, false)
    ))
    .orderBy(productDeliveryUnitsTable.id)
    .limit(qty);

  if (availableUnits.length < qty) {
    res.status(400).json({ error: "Not enough delivery units available. Contact admin." });
    return;
  }

  // Deduct points
  await db
    .update(usersTable)
    .set({ points: user.points - totalPrice })
    .where(eq(usersTable.id, userId));

  // Decrease stock
  await db
    .update(productsTable)
    .set({ stock: product.stock - qty })
    .where(eq(productsTable.id, productId));

  // Record purchase
  await db.insert(productPurchasesTable).values({
    productId,
    userId,
    quantity: qty,
    totalPrice,
  });

  // Mark delivery units as delivered to this user
  const unitIds = availableUnits.map((u) => u.id);
  await db
    .update(productDeliveryUnitsTable)
    .set({ isDelivered: true, userId })
    .where(inArray(productDeliveryUnitsTable.id, unitIds));

  // Auto-message the user with the delivered items
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, true))
    .limit(1);

  const senderId = admin?.id ?? product.createdBy;

  const now = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  const deliveredItems = availableUnits.map((u, i) => `▸ Item ${i + 1}: \`${u.content}\``).join("\n");

  const msgContent = `**Order Confirmed**

**${product.title}**
Qty: ${qty}  ·  ${totalPrice} pts
${now}

**Your Items:**
${deliveredItems}

_Keep this message safe. Contact support if you have any issues._`;

  await db
    .insert(messagesTable)
    .values({ senderId, receiverId: userId, content: msgContent });

  res.json({
    success: true,
    message: "Purchase successful! Your items have been delivered to your messages.",
    deliveredCount: qty,
  });
});

// ── Admin: list all purchases ──
router.get("/admin/purchases", requireAdmin, async (_req, res) => {
  const purchases = await db
    .select({
      id: productPurchasesTable.id,
      quantity: productPurchasesTable.quantity,
      totalPrice: productPurchasesTable.totalPrice,
      createdAt: productPurchasesTable.createdAt,
      productId: productPurchasesTable.productId,
      productTitle: productsTable.title,
      userId: productPurchasesTable.userId,
      username: usersTable.username,
    })
    .from(productPurchasesTable)
    .leftJoin(productsTable, eq(productPurchasesTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(productPurchasesTable.userId, usersTable.id))
    .orderBy(desc(productPurchasesTable.createdAt));

  res.json(purchases);
});

export default router;
