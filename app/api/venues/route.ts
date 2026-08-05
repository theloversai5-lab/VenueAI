import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  eventType: z.string().max(100).optional(),
  guestCount: z.coerce.number().int().positive().optional(),
  budget: z.coerce.number().nonnegative().optional(),
});

export async function GET() {
  const user = await getOrCreateAppUser();
  const rows = await db.query.venues.findMany({
    where: eq(venues.ownerUserId, user.id),
    orderBy: desc(venues.createdAt),
  });
  return NextResponse.json({ venues: rows });
}

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [venue] = await db
    .insert(venues)
    .values({
      ownerUserId: user.id,
      name: parsed.data.name,
      address: parsed.data.address,
      eventType: parsed.data.eventType,
      guestCount: parsed.data.guestCount,
      budget: parsed.data.budget?.toString(),
    })
    .returning();

  return NextResponse.json({ venue }, { status: 201 });
}
