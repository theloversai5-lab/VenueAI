import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues, referenceImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { AREA_OPTIONS } from "@/lib/areas";

const bodySchema = z.object({
  venueId: z.string().uuid(),
  blobUrl: z.string().url(),
  blobPathname: z.string().min(1),
  area: z.enum(AREA_OPTIONS).optional(),
});

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, parsed.data.venueId), eq(venues.ownerUserId, user.id)),
  });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const [image] = await db.insert(referenceImages).values(parsed.data).returning();
  return NextResponse.json({ image }, { status: 201 });
}
