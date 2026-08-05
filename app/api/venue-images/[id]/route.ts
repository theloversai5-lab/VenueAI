import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { venueImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getOwnedVenueImage } from "@/lib/venue-images";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();
  const image = await getOwnedVenueImage(user.id, id);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await del(image.blobUrl).catch(() => {});
  await db.delete(venueImages).where(eq(venueImages.id, id));
  return NextResponse.json({ ok: true });
}
