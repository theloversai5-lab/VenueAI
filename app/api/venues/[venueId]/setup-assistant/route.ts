import { NextResponse } from "next/server";
import { generateText, Output, type ModelMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues, venueImages, referenceImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { groq, GROQ_VISION_MODEL } from "@/lib/ai";
import { AREA_OPTIONS } from "@/lib/areas";
import { ANGLE_OPTIONS } from "@/lib/angles";
import { assertHasCredits, logUsageAndCharge, InsufficientCreditsError } from "@/lib/usage";
import { analyzeVenueImageScene, generateRenderForVenueImage, PipelineError } from "@/lib/pipeline";

const MAX_IMAGES = 8;
const FORCE_DECISION_AFTER_TURNS = 2; // ask at most this many clarifying questions before finalizing

const bodySchema = z.object({
  images: z
    .array(
      z.object({
        blobUrl: z.string().url(),
        blobPathname: z.string().min(1),
        // Set when the image came from an angle-labeled upload card in the
        // UI rather than a generic dropzone — the model doesn't need to
        // guess kind/angle for these, only (for references) the area.
        presetKind: z.enum(["venue", "reference"]).optional(),
        presetAngle: z.enum(ANGLE_OPTIONS).optional(),
      }),
    )
    .max(MAX_IMAGES),
  prompt: z.string().max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(10),
});

const turnSchema = z.object({
  done: z.boolean(),
  question: z.string().optional(),
  mapping: z
    .array(
      z.object({
        imageIndex: z.number().int().min(0),
        kind: z.enum(["venue", "reference"]),
        angleLabel: z.enum(ANGLE_OPTIONS).optional(),
        area: z.enum(AREA_OPTIONS).optional(),
      }),
    )
    .optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.ownerUserId, user.id)),
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { images, prompt, history } = parsed.data;

  // Nothing to sort or generate from — skip the AI call entirely rather
  // than spend a call reasoning about zero images.
  if (images.length === 0) {
    return NextResponse.json({ done: true, venueImages: [], referenceImages: [], analyses: [], renders: [] });
  }

  try {
    await assertHasCredits(user.id);
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw e;
  }

  const questionsAskedSoFar = history.filter((h) => h.role === "assistant").length;
  const mustDecideNow = questionsAskedSoFar >= FORCE_DECISION_AFTER_TURNS;

  const instructions = [
    `You are helping set up an event venue design project. The user uploaded ${images.length} image(s), each already labeled by the upload UI as noted below — "venue" images are photos of the real space, "reference" images are style inspiration.`,
    `User's request: "${prompt}"`,
    `For each image, its kind (and angle, if a venue photo) is already given — do NOT ask about or change those. Your only job per "reference" image is to decide which venue area it represents, from: ${AREA_OPTIONS.join(", ")}.`,
    `If which area a reference image belongs to is genuinely ambiguous given the prompt, ask ONE short clarifying question instead of guessing — set done=false and fill "question". Otherwise set done=true and provide "mapping" for every image (repeat back the given kind/angle, plus your area pick for references).`,
    mustDecideNow
      ? `You have already asked enough questions — you MUST set done=true now and make your best-guess area for every reference image, even if uncertain.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const historyText = history.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: instructions + (historyText ? `\n\nConversation so far:\n${historyText}` : "") },
        ...images.flatMap((img, i) => [
          {
            type: "text" as const,
            text: `Image ${i}: ${img.presetKind ? `already labeled as ${img.presetKind}${img.presetAngle ? ` (${img.presetAngle})` : ""}` : "unlabeled"}.`,
          },
          { type: "file" as const, mediaType: "image" as const, data: img.blobUrl },
        ]),
      ],
    },
  ];

  const result = await generateText({
    model: groq(GROQ_VISION_MODEL),
    output: Output.object({ schema: turnSchema }),
    messages,
  });

  await logUsageAndCharge({
    userId: user.id,
    provider: "groq",
    model: GROQ_VISION_MODEL,
    operation: "setup_mapping",
    usage: result.usage,
    metadata: { venueId, imageCount: images.length, turn: history.length },
  });

  if (!result.output.done || !result.output.mapping) {
    return NextResponse.json({ done: false, question: result.output.question ?? "Could you clarify?" });
  }

  // Finalize: persist rows, then run scene analysis + render generation for
  // whatever the mapping produced. Each step is independently try/caught so
  // one image's failure doesn't sink the whole batch.
  const mappingByIndex = new Map(result.output.mapping.map((m) => [m.imageIndex, m]));
  const createdVenueImages: (typeof venueImages.$inferSelect)[] = [];
  const createdReferenceImages: (typeof referenceImages.$inferSelect)[] = [];

  for (let i = 0; i < images.length; i++) {
    const entry = mappingByIndex.get(i);
    const img = images[i];
    const kind = img.presetKind ?? entry?.kind ?? "reference";

    if (kind === "venue") {
      const [row] = await db
        .insert(venueImages)
        .values({
          venueId,
          blobUrl: img.blobUrl,
          blobPathname: img.blobPathname,
          angleLabel: img.presetAngle ?? entry?.angleLabel,
        })
        .returning();
      createdVenueImages.push(row);
    } else {
      const [row] = await db
        .insert(referenceImages)
        .values({
          venueId,
          blobUrl: img.blobUrl,
          blobPathname: img.blobPathname,
          area: entry?.area,
          areaSource: entry?.area ? "ai_suggested" : null,
        })
        .returning();
      createdReferenceImages.push(row);
    }
  }

  const analyses: unknown[] = [];
  for (const vi of createdVenueImages) {
    try {
      analyses.push(await analyzeVenueImageScene(user.id, vi.id));
    } catch (e) {
      analyses.push({ venueImageId: vi.id, error: e instanceof PipelineError ? e.message : "Scene analysis failed" });
    }
  }

  const renders: unknown[] = [];
  for (const vi of createdVenueImages) {
    try {
      renders.push(await generateRenderForVenueImage(user.id, vi.id));
    } catch (e) {
      renders.push({ venueImageId: vi.id, error: e instanceof PipelineError ? e.message : "Render generation failed" });
    }
  }

  return NextResponse.json({
    done: true,
    venueImages: createdVenueImages,
    referenceImages: createdReferenceImages,
    analyses,
    renders,
  });
}
