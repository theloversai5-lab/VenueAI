import { NextResponse } from "next/server";
import { generateImage } from "ai";
import { and, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { renders, referenceImages, venueImageAnalysis } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedVenueImage } from "@/lib/venue-images";
import { getOrCreateDraftDesign } from "@/lib/designs";
import { google, GEMINI_IMAGE_MODEL } from "@/lib/ai";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const MAX_REFERENCE_IMAGES = 2;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const venueImage = await getOwnedVenueImage(user.id, id);
  if (!venueImage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const analysis = await db.query.venueImageAnalysis.findFirst({
    where: eq(venueImageAnalysis.venueImageId, id),
  });
  if (!analysis?.zoneLabel) {
    return NextResponse.json({ error: "Analyze this photo's scene first" }, { status: 400 });
  }

  // Auto-mapping: a reference image's `area` matches this venue photo's
  // `zoneLabel` directly — see the comment on venue_image_analysis in
  // db/schema.ts for why the two share one taxonomy.
  const matchedReferences = await db.query.referenceImages.findMany({
    where: and(eq(referenceImages.venueId, venueImage.venueId), eq(referenceImages.area, analysis.zoneLabel)),
    limit: MAX_REFERENCE_IMAGES,
  });
  if (matchedReferences.length === 0) {
    return NextResponse.json(
      { error: `No reference images tagged "${analysis.zoneLabel}" yet for this venue` },
      { status: 400 },
    );
  }

  try {
    await assertHasCredits(user.id);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw e;
  }

  const design = await getOrCreateDraftDesign(venueImage.venueId);

  const [render] = await db
    .insert(renders)
    .values({
      designId: design.id,
      venueImageId: id,
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

    const blob = await put(`venues/${venueImage.venueId}/renders/${render.id}.png`, Buffer.from(result.image.uint8Array), {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
    });

    await logUsageAndCharge({
      userId: user.id,
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

    return NextResponse.json({ render: updated });
  } catch (error) {
    await db
      .update(renders)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(renders.id, render.id));

    return NextResponse.json({ error: "Render generation failed" }, { status: 500 });
  }
}
