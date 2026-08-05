import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { designComponents } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedReferenceImage } from "@/lib/reference-images";
import { groq, GROQ_VISION_MODEL } from "@/lib/ai";
import { COMPONENT_CATEGORIES } from "@/lib/component-categories";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";

const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const extractionSchema = z.object({
  components: z
    .array(
      z.object({
        category: z.enum(COMPONENT_CATEGORIES),
        boundingBox: boundingBoxSchema,
        material: z.string().optional(),
        colorPalette: z.array(z.string()).max(4).optional(),
        sizeClass: z.enum(["small", "medium", "large"]).optional(),
      }),
    )
    .max(12),
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
    output: Output.object({ schema: extractionSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Identify the individual reusable decor/design components visible in this event venue reference image (e.g. flowers, lighting fixtures, drapery/fabric, furniture, pillars, signage, bar counters, tables, chairs, ceiling treatments). For each, classify it into exactly one of: ${COMPONENT_CATEGORIES.join(", ")}. Give a normalized bounding box (x, y, width, height, each 0-1, relative to the full image) around that component, plus its dominant material, up to 4 color words, and a rough size class (small/medium/large). Return up to 12 of the most visually distinct components — skip anything too small or ambiguous to place a useful box around.`,
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
    operation: "component_extraction",
    usage: result.usage,
    metadata: { referenceImageId: id, componentCount: result.output.components.length },
  });

  const rows =
    result.output.components.length > 0
      ? await db
          .insert(designComponents)
          .values(
            result.output.components.map((c) => ({
              venueId: image.venueId,
              referenceImageId: id,
              category: c.category,
              boundingBox: c.boundingBox,
              attributes: {
                material: c.material,
                colorPalette: c.colorPalette,
                sizeClass: c.sizeClass,
              },
            })),
          )
          .returning()
      : [];

  return NextResponse.json({ components: rows, costUsd, chargedCredits });
}
