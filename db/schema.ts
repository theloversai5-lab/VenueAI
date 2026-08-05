import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk userId
  email: text("email").notNull(),
  name: text("name"),
  phoneNumber: text("phone_number"),
  companyName: text("company_name"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  eventType: text("event_type"),
  guestCount: integer("guest_count"),
  budget: numeric("budget"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venueImages = pgTable("venue_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  angleLabel: text("angle_label"), // front | aerial | satellite | interior | other
  width: integer("width"),
  height: integer("height"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referenceImages = pgTable("reference_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  area: text("area"), // entrance | stage | mandap | lounge | bar | dining | ceiling | walkway | other
  areaSource: text("area_source"), // manual | ai_suggested — null until tagged either way
  styleTags: text("style_tags").array(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceCredits: integer("balance_credits").notNull().default(0),
  lifetimeAddedCredits: integer("lifetime_added_credits").notNull().default(0),
  lifetimeUsedCredits: integer("lifetime_used_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // signup_bonus | purchase | usage | admin_grant
  credits: integer("credits").notNull(), // signed: + for grant/purchase, - for usage
  reason: text("reason"),
  relatedPaymentId: uuid("related_payment_id"),
  relatedUsageLogId: uuid("related_usage_log_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  amountInr: integer("amount_inr").notNull(), // in paise, matches Razorpay convention
  creditsGranted: integer("credits_granted").notNull(),
  status: text("status").notNull().default("created"), // created | paid | failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per AI call. Written by Phase 2+ only — table exists now so no
// migration is needed when real usage logging starts.
export const apiUsageLog = pgTable("api_usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // gemini | groq | ...
  model: text("model").notNull(),
  operation: text("operation").notNull(), // image_generation | vision_analysis | ...
  reportedCostUsd: numeric("reported_cost_usd").notNull(),
  chargedCredits: integer("charged_credits").notNull(), // reportedCostUsd * 5, converted to credits
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
