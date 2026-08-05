import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  numeric,
  jsonb,
  type AnyPgColumn,
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

// Structured scene understanding for one venue photo. `zoneLabel` reuses the
// same area taxonomy as reference_images.area (see lib/areas.ts) — Phase 5's
// auto-mapping matches a reference image's area straight to a venue photo's
// zoneLabel, so keeping one vocabulary here is what makes that mapping a
// simple equality check instead of a second classification problem.
export const venueImageAnalysis = pgTable("venue_image_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueImageId: uuid("venue_image_id")
    .notNull()
    .unique()
    .references(() => venueImages.id, { onDelete: "cascade" }),
  zoneLabel: text("zone_label"), // entrance | stage | mandap | lounge | bar | dining | ceiling | walkway | other
  obstacles: jsonb("obstacles"), // [{ type, boundingBox: {x,y,width,height} }]
  perspectiveNotes: jsonb("perspective_notes"), // { horizonLineY?, scaleReferenceNote? }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

// A decor element (flowers, lighting, furniture, ...) extracted from a
// reference image, not physically cropped server-side — `boundingBox` is
// normalized (0..1) coordinates into the source image, and the UI renders a
// visual "crop" client-side via CSS background-position/size rather than
// generating a new image file. Scoped to venueId (denormalized from
// referenceImageId) to match the per-venue reference-image scope decided in
// Phase 1 — not a cross-venue global library.
export const designComponents = pgTable("design_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  referenceImageId: uuid("reference_image_id")
    .notNull()
    .references(() => referenceImages.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // flowers | lighting | fabric | furniture | pillar | signage | bar | table | chair | ceiling | other
  boundingBox: jsonb("bounding_box").notNull(), // { x, y, width, height } normalized 0..1
  attributes: jsonb("attributes"), // { material?, colorPalette?, sizeClass?, styleTags? }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A "design attempt" for a venue — the container renders attach to.
// One venue can have multiple designs over time (re-attempts), though
// Phase 5's UI only ever creates/reuses a single draft one for now.
export const designs = pgTable("designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Design 1"),
  status: text("status").notNull().default("draft"), // draft | in_progress | complete
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One async generation job + its result. `parentRenderId` is unused until
// Phase 8's feedback-driven regeneration but included now so that table
// doesn't need a migration later — a regeneration becomes a new Render
// versioned off the one the feedback was about, rather than mutating it.
export const renders = pgTable("renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  venueImageId: uuid("venue_image_id")
    .notNull()
    .references(() => venueImages.id, { onDelete: "cascade" }),
  area: text("area"), // the matched area/zone this render was generated for
  jobType: text("job_type").notNull().default("placement"), // placement | perspective_correction
  referenceImageIds: jsonb("reference_image_ids"), // string[] — references used as conditioning
  status: text("status").notNull().default("queued"), // queued | running | succeeded | failed
  resultBlobUrl: text("result_blob_url"),
  errorMessage: text("error_message"),
  parentRenderId: uuid("parent_render_id").references((): AnyPgColumn => renders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// A generated top-down 2D layout for a design — structured coordinates
// rendered client-side as SVG, not an image-generation call (see Phase 6
// notes: layout is a different kind of output than a photorealistic render,
// so it gets its own table rather than overloading `renders`).
export const layouts = pgTable("layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  elements: jsonb("elements").notNull(), // [{ type, label, x, y, width, height, rotation }] normalized 0..1
  guestCount: integer("guest_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A generated client-facing output file (currently: the combined
// presentation PDF). Deterministic assembly from already-generated data
// (renders, references, component library) — no AI call, so no credit
// charge for creating one.
export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // presentation_pdf (more types — moodboard, bom — can reuse this table later)
  blobUrl: text("blob_url").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A client note on a specific render ("make shelves higher", "less disco
// balls") that immediately triggers a scoped regeneration rather than a
// whole new design attempt. `resultRenderId` points at the new Render the
// feedback produced (versioned off the original via renders.parentRenderId)
// — the row here exists mainly as an audit trail of what was asked for.
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  renderId: uuid("render_id")
    .notNull()
    .references(() => renders.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: text("status").notNull().default("pending"), // pending | applied | failed
  resultRenderId: uuid("result_render_id").references((): AnyPgColumn => renders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
