import { eq } from "drizzle-orm";
import { db } from "@/db";
import { renders, designs, venues } from "@/db/schema";

export async function getOwnedRender(userId: string, id: string) {
  const row = await db
    .select({ render: renders, ownerUserId: venues.ownerUserId, venueId: venues.id })
    .from(renders)
    .innerJoin(designs, eq(designs.id, renders.designId))
    .innerJoin(venues, eq(venues.id, designs.venueId))
    .where(eq(renders.id, id))
    .then((r) => r[0]);

  return row && row.ownerUserId === userId ? row : null;
}
