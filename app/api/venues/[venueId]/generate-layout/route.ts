import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues, venueImageAnalysis, venueImages, designComponents, layouts } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOrCreateDraftDesign } from "@/lib/designs";
import { groq, GROQ_VISION_MODEL } from "@/lib/ai";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const elementSchema = z.object({
  type: z.string(), // e.g. entrance, stage, mandap, dining_table, chair_cluster, bar, dancefloor, walkway
  label: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  rotation: z.number().min(0).max(359).optional(),
});

const layoutSchema = z.object({ elements: z.array(elementSchema).max(40) });

export async function POST(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.ownerUserId, user.id)),
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zones = await db
    .select({ zoneLabel: venueImageAnalysis.zoneLabel })
    .from(venueImageAnalysis)
    .innerJoin(venueImages, eq(venueImages.id, venueImageAnalysis.venueImageId))
    .where(eq(venueImages.venueId, venueId));
  const zoneLabels = [...new Set(zones.map((z) => z.zoneLabel).filter(Boolean))];

  const componentCounts = await db
    .select({ category: designComponents.category, count: sql<number>`count(*)` })
    .from(designComponents)
    .where(eq(designComponents.venueId, venueId))
    .groupBy(designComponents.category);

  if (zoneLabels.length === 0) {
    return NextResponse.json({ error: "Analyze at least one venue photo's scene first" }, { status: 400 });
  }

  try {
    await assertHasCredits(user.id);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw e;
  }

  const prompt = [
    `Generate a top-down 2D event layout plan for this venue as a set of positioned rectangles on a normalized 0..1 x 0..1 canvas (0,0 = top-left).`,
    `Event type: ${venue.eventType ?? "not specified"}.`,
    `Guest count: ${venue.guestCount ?? "not specified"}.`,
    `Known venue areas (place one zone per area, non-overlapping): ${zoneLabels.join(", ")}.`,
    componentCounts.length > 0
      ? `Available decor component categories: ${componentCounts.map((c) => `${c.category} (${c.count})`).join(", ")}.`
      : null,
    `Include the known areas, plus reasonable furniture groupings for guest capacity (dining tables/chair clusters sized for the guest count if dining is present), a walkway/guest-flow path connecting areas, and keep everything within the 0..1 bounds without excessive overlap.`,
  ]
    .filter(Boolean)
    .join(" ");

  const result = await generateText({
    model: groq(GROQ_VISION_MODEL),
    output: Output.object({ schema: layoutSchema }),
    prompt,
  });

  const { costUsd, chargedCredits } = await logUsageAndCharge({
    userId: user.id,
    provider: "groq",
    model: GROQ_VISION_MODEL,
    operation: "layout_generation",
    usage: result.usage,
    metadata: { venueId },
  });

  const design = await getOrCreateDraftDesign(venueId);

  const [layout] = await db
    .insert(layouts)
    .values({
      designId: design.id,
      elements: result.output.elements,
      guestCount: venue.guestCount,
    })
    .returning();

  return NextResponse.json({ layout, costUsd, chargedCredits });
}
