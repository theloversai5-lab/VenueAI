import { generateText, generateImage, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db";
import { venueImageAnalysis, renders, referenceImages } from "@/db/schema";
import { getOwnedVenueImage } from "@/lib/venue-images";
import { getOrCreateDraftDesign } from "@/lib/designs";
import { groq, google, GROQ_VISION_MODEL, GEMINI_IMAGE_MODEL } from "@/lib/ai";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";
import { AREA_OPTIONS } from "@/lib/areas";

// Shared pipeline steps — used by both their dedicated API routes (single
// venue-image, user-triggered) and the bulk setup-assistant orchestrator
// (multiple images, one conversational flow). Keeping the logic here means
// neither caller duplicates it or has to make a fragile self-HTTP call.

export class PipelineError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const sceneSchema = z.object({
  zoneLabel: z.enum(AREA_OPTIONS),
  obstacles: z
    .array(z.object({ type: z.string(), boundingBox: boundingBoxSchema }))
    .max(10),
  horizonLineY: z.number().min(0).max(1).optional(),
  scaleReferenceNote: z.string().optional(),
});

export async function analyzeVenueImageScene(userId: string, venueImageId: string) {
  const image = await getOwnedVenueImage(userId, venueImageId);
  if (!image) throw new PipelineError("Venue photo not found", 404);

  try {
    await assertHasCredits(userId);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) throw new PipelineError("Insufficient credits", 402);
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

  await logUsageAndCharge({
    userId,
    provider: "groq",
    model: GROQ_VISION_MODEL,
    operation: "scene_analysis",
    usage: result.usage,
    metadata: { venueImageId },
  });

  const { zoneLabel, obstacles, horizonLineY, scaleReferenceNote } = result.output;

  const [analysis] = await db
    .insert(venueImageAnalysis)
    .values({ venueImageId, zoneLabel, obstacles, perspectiveNotes: { horizonLineY, scaleReferenceNote } })
    .onConflictDoUpdate({
      target: venueImageAnalysis.venueImageId,
      set: { zoneLabel, obstacles, perspectiveNotes: { horizonLineY, scaleReferenceNote } },
    })
    .returning();

  return analysis;
}

const MAX_REFERENCE_IMAGES = 2;

export async function generateRenderForVenueImage(userId: string, venueImageId: string) {
  const venueImage = await getOwnedVenueImage(userId, venueImageId);
  if (!venueImage) throw new PipelineError("Venue photo not found", 404);

  const analysis = await db.query.venueImageAnalysis.findFirst({
    where: eq(venueImageAnalysis.venueImageId, venueImageId),
  });
  if (!analysis?.zoneLabel) throw new PipelineError("Analyze this photo's scene first");

  const matchedReferences = await db.query.referenceImages.findMany({
    where: and(eq(referenceImages.venueId, venueImage.venueId), eq(referenceImages.area, analysis.zoneLabel)),
    limit: MAX_REFERENCE_IMAGES,
  });
  if (matchedReferences.length === 0) {
    throw new PipelineError(`No reference images tagged "${analysis.zoneLabel}" yet for this venue`);
  }

  try {
    await assertHasCredits(userId);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) throw new PipelineError("Insufficient credits", 402);
    throw e;
  }

  const design = await getOrCreateDraftDesign(venueImage.venueId);

  const [render] = await db
    .insert(renders)
    .values({
      designId: design.id,
      venueImageId,
      area: analysis.zoneLabel,
      referenceImageIds: matchedReferences.map((r) => r.id),
      status: "running",
    })
    .returning();

  try {
    const [venueBuffer, ...referenceBuffers] = await Promise.all([
      fetchImageBuffer(venueImage.blobUrl),
      ...matchedReferences.map((r) => fetchImageBuffer(r.blobUrl)),
    ]);

    const obstacleTypes = ((analysis.obstacles as Array<{ type: string }> | null) ?? []).map((o) => o.type);
    const styleTags = matchedReferences.flatMap((r) => r.styleTags ?? []);

    const prompt = [
      `Decorate this venue photo (first image) for its "${analysis.zoneLabel}" area, taking style inspiration from the reference image(s) that follow.`,
      obstacleTypes.length > 0
        ? `Preserve these existing structures exactly where they are: ${obstacleTypes.join(", ")}.`
        : null,
      styleTags.length > 0 ? `Style cues: ${styleTags.join(", ")}.` : null,
      "Keep the venue's real geometry, camera angle, and lighting direction — this should look like a real photograph of the decorated venue, not a collage.",
    ]
      .filter(Boolean)
      .join(" ");

    const result = await generateImage({
      model: google.image(GEMINI_IMAGE_MODEL),
      prompt: { text: prompt, images: [venueBuffer, ...referenceBuffers] },
    });

    const blob = await put(
      `venues/${venueImage.venueId}/renders/${render.id}.png`,
      Buffer.from(result.image.uint8Array),
      { access: "public", addRandomSuffix: false, contentType: "image/png" },
    );

    await logUsageAndCharge({
      userId,
      provider: "gemini",
      model: GEMINI_IMAGE_MODEL,
      operation: "image_generation",
      usage: result.usage,
      metadata: { renderId: render.id },
    });

    const [updated] = await db
      .update(renders)
      .set({ status: "succeeded", resultBlobUrl: blob.url, completedAt: new Date() })
      .where(eq(renders.id, render.id))
      .returning();

    return updated;
  } catch (error) {
    await db
      .update(renders)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(renders.id, render.id));
    throw new PipelineError("Render generation failed", 500);
  }
}
