import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { venueImageAnalysis } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedVenueImage } from "@/lib/venue-images";
import { groq, GROQ_VISION_MODEL } from "@/lib/ai";
import { AREA_OPTIONS } from "@/lib/areas";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const sceneSchema = z.object({
  zoneLabel: z.enum(AREA_OPTIONS),
  obstacles: z
    .array(
      z.object({
        type: z.string(), // e.g. "tree", "pool", "pillar", "wall", "existing structure"
        boundingBox: boundingBoxSchema,
      }),
    )
    .max(10),
  horizonLineY: z.number().min(0).max(1).optional(),
  scaleReferenceNote: z.string().optional(),
});

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const image = await getOwnedVenueImage(user.id, id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await assertHasCredits(user.id);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw e;
  }

  const result = await generateText({
    model: groq(GROQ_VISION_MODEL),
    output: Output.object({ schema: sceneSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a photo of an event venue before decoration. Classify which single area of the venue this photo primarily shows, from this fixed list: ${AREA_OPTIONS.join(", ")}. Also identify fixed existing obstacles/structures that must be preserved or worked around when adding decor (trees, pools, pillars, walls, permanent buildings, walkways) with a normalized bounding box (x, y, width, height, each 0-1) for each. If useful for later perspective matching, estimate the horizon line's vertical position (0=top, 1=bottom of the image) and note any object in frame usable as a scale reference (e.g. "the doorway is roughly 2m tall").`,
          },
          { type: "file", mediaType: "image", data: image.blobUrl },
        ],
      },
    ],
  });

  const { costUsd, chargedCredits } = await logUsageAndCharge({
    userId: user.id,
    provider: "groq",
    model: GROQ_VISION_MODEL,
    operation: "scene_analysis",
    usage: result.usage,
    metadata: { venueImageId: id },
  });

  const { zoneLabel, obstacles, horizonLineY, scaleReferenceNote } = result.output;

  const [analysis] = await db
    .insert(venueImageAnalysis)
    .values({
      venueImageId: id,
      zoneLabel,
      obstacles,
      perspectiveNotes: { horizonLineY, scaleReferenceNote },
    })
    .onConflictDoUpdate({
      target: venueImageAnalysis.venueImageId,
      set: {
        zoneLabel,
        obstacles,
        perspectiveNotes: { horizonLineY, scaleReferenceNote },
      },
    })
    .returning();

  return NextResponse.json({ analysis, costUsd, chargedCredits });
}
