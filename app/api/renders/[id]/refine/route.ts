import { NextResponse } from "next/server";
import { generateImage } from "ai";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { renders, venueImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedRender } from "@/lib/renders";
import { google, GEMINI_IMAGE_MODEL } from "@/lib/ai";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const owned = await getOwnedRender(user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owned.render.status !== "succeeded" || !owned.render.resultBlobUrl) {
    return NextResponse.json({ error: "Only a succeeded render can be refined" }, { status: 400 });
  }

  const venueImage = await db.query.venueImages.findFirst({
    where: eq(venueImages.id, owned.render.venueImageId),
  });
  if (!venueImage) return NextResponse.json({ error: "Source venue photo not found" }, { status: 404 });

  try {
    await assertHasCredits(user.id);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw e;
  }

  const [newRender] = await db
    .insert(renders)
    .values({
      designId: owned.render.designId,
      venueImageId: owned.render.venueImageId,
      area: owned.render.area,
      jobType: "perspective_correction",
      referenceImageIds: owned.render.referenceImageIds,
      parentRenderId: owned.render.id,
      status: "running",
    })
    .returning();

  try {
    const [originalPhoto, priorRender] = await Promise.all([
      fetchImageBuffer(venueImage.blobUrl),
      fetchImageBuffer(owned.render.resultBlobUrl),
    ]);

    const prompt =
      "The second image is a decorated version of the first (original, undecorated) venue photo. " +
      "Refine the second image: fix any perspective distortion so decor elements align naturally with " +
      "the venue's real geometry and camera angle from the first image, match lighting direction and " +
      "color temperature to the original photo, and smooth any visible seams or blending artifacts " +
      "between decor and venue. Keep all decor elements, their positions, and the overall composition — " +
      "only correct realism, not content.";

    const result = await generateImage({
      model: google.image(GEMINI_IMAGE_MODEL),
      prompt: { text: prompt, images: [originalPhoto, priorRender] },
    });

    const blob = await put(
      `venues/${venueImage.venueId}/renders/${newRender.id}.png`,
      Buffer.from(result.image.uint8Array),
      { access: "public", addRandomSuffix: false, contentType: "image/png" },
    );

    await logUsageAndCharge({
      userId: user.id,
      provider: "gemini",
      model: GEMINI_IMAGE_MODEL,
      operation: "perspective_correction",
      usage: result.usage,
      metadata: { renderId: newRender.id, parentRenderId: owned.render.id },
    });

    const [updated] = await db
      .update(renders)
      .set({ status: "succeeded", resultBlobUrl: blob.url, completedAt: new Date() })
      .where(eq(renders.id, newRender.id))
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
      .where(eq(renders.id, newRender.id));

    return NextResponse.json({ error: "Refinement failed" }, { status: 500 });
  }
}
