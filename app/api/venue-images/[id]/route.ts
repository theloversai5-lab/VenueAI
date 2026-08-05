import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { venueImages, venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();

  const row = await db
    .select({ image: venueImages, ownerUserId: venues.ownerUserId })
    .from(venueImages)
    .innerJoin(venues, eq(venues.id, venueImages.venueId))
    .where(eq(venueImages.id, id))
    .then((r) => r[0]);

  if (!row || row.ownerUserId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await del(row.image.blobUrl).catch(() => {});
  await db.delete(venueImages).where(eq(venueImages.id, id));
  return NextResponse.json({ ok: true });
}
