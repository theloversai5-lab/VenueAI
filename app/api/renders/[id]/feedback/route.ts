import { NextResponse } from "next/server";
import { generateImage } from "ai";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db";
import { renders, venueImages, feedback } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedRender } from "@/lib/renders";
import { google, GEMINI_IMAGE_MODEL } from "@/lib/ai";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const bodySchema = z.object({ text: z.string().min(1).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const owned = await getOwnedRender(user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owned.render.status !== "succeeded" || !owned.render.resultBlobUrl) {
    return NextResponse.json({ error: "Only a succeeded render can receive feedback" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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

  const [feedbackRow] = await db
    .insert(feedback)
    .values({ renderId: owned.render.id, text: parsed.data.text, status: "pending" })
    .returning();

  const [newRender] = await db
    .insert(renders)
    .values({
      designId: owned.render.designId,
      venueImageId: owned.render.venueImageId,
      area: owned.render.area,
      jobType: "placement",
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
      `The second image is a decorated version of the first (original, undecorated) venue photo. ` +
      `Apply this specific client change to the decorated version, keeping everything else about the ` +
      `composition, style, and content the same: "${parsed.data.text}".`;

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
      operation: "feedback_revision",
      usage: result.usage,
      metadata: { renderId: newRender.id, parentRenderId: owned.render.id, feedbackId: feedbackRow.id },
    });

    const [updatedRender] = await db
      .update(renders)
      .set({ status: "succeeded", resultBlobUrl: blob.url, completedAt: new Date() })
      .where(eq(renders.id, newRender.id))
      .returning();

    const [updatedFeedback] = await db
      .update(feedback)
      .set({ status: "applied", resultRenderId: newRender.id })
      .where(eq(feedback.id, feedbackRow.id))
      .returning();

    return NextResponse.json({ render: updatedRender, feedback: updatedFeedback });
  } catch (error) {
    await db
      .update(renders)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(renders.id, newRender.id));
    await db.update(feedback).set({ status: "failed" }).where(eq(feedback.id, feedbackRow.id));

    return NextResponse.json({ error: "Feedback revision failed" }, { status: 500 });
  }
}
