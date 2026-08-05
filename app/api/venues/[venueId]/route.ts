import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

async function ownedVenue(userId: string, venueId: string) {
  return db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.ownerUserId, userId)),
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await ownedVenue(user.id, venueId);
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ venue });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await ownedVenue(user.id, venueId);
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(venues).where(eq(venues.id, venueId));
  return NextResponse.json({ ok: true });
}
