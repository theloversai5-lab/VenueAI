import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db";
import { referenceImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { AREA_OPTIONS } from "@/lib/areas";
import { getOwnedReferenceImage } from "@/lib/reference-images";

const patchSchema = z.object({ area: z.enum(AREA_OPTIONS) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const image = await getOwnedReferenceImage(user.id, id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // A human explicitly setting the area always wins over any prior AI
  // suggestion — mark the source so future re-classify passes know not to
  // silently overwrite a human correction without being asked.
  const [updated] = await db
    .update(referenceImages)
    .set({ area: parsed.data.area, areaSource: "manual" })
    .where(eq(referenceImages.id, id))
    .returning();

  return NextResponse.json({ image: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const image = await getOwnedReferenceImage(user.id, id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await del(image.blobUrl).catch(() => {});
  await db.delete(referenceImages).where(eq(referenceImages.id, id));
  return NextResponse.json({ ok: true });
}
