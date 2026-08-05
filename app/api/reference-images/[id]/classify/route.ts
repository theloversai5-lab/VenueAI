import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { referenceImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedReferenceImage } from "@/lib/reference-images";
import { groq, GROQ_VISION_MODEL } from "@/lib/ai";
import { AREA_OPTIONS } from "@/lib/areas";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const classificationSchema = z.object({
  area: z.enum(AREA_OPTIONS),
  styleTags: z.array(z.string()).max(6),
});

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const image = await getOwnedReferenceImage(user.id, id);
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
    output: Output.object({ schema: classificationSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a decor/event reference image for a venue design project. Classify which venue area it best represents from this fixed list: ${AREA_OPTIONS.join(", ")}. Also return up to 6 short style tags (e.g. colors, theme, mood — "gold", "floral", "modern", "royal").`,
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
    operation: "vision_analysis",
    usage: result.usage,
    metadata: { referenceImageId: id },
  });

  const [updated] = await db
    .update(referenceImages)
    .set({
      area: result.output.area,
      areaSource: "ai_suggested",
      styleTags: result.output.styleTags,
    })
    .where(eq(referenceImages.id, id))
    .returning();

  return NextResponse.json({ image: updated, costUsd, chargedCredits });
}
