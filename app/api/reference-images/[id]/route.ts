import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db";
import { referenceImages, venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { AREA_OPTIONS } from "@/lib/areas";

const patchSchema = z.object({ area: z.enum(AREA_OPTIONS) });

async function ownedReferenceImage(userId: string, id: string) {
  return db
    .select({ image: referenceImages, ownerUserId: venues.ownerUserId })
    .from(referenceImages)
    .innerJoin(venues, eq(venues.id, referenceImages.venueId))
    .where(eq(referenceImages.id, id))
    .then((r) => r[0])
    .then((row) => (row && row.ownerUserId === userId ? row : null));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const row = await ownedReferenceImage(user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(referenceImages)
    .set({ area: parsed.data.area })
    .where(eq(referenceImages.id, id))
    .returning();

  return NextResponse.json({ image: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const row = await ownedReferenceImage(user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await del(row.image.blobUrl).catch(() => {});
  await db.delete(referenceImages).where(eq(referenceImages.id, id));
  return NextResponse.json({ ok: true });
}
