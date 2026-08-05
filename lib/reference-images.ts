import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceImages, venues } from "@/db/schema";

export async function getOwnedReferenceImage(userId: string, id: string) {
  const row = await db
    .select({ image: referenceImages, ownerUserId: venues.ownerUserId })
    .from(referenceImages)
    .innerJoin(venues, eq(venues.id, referenceImages.venueId))
    .where(eq(referenceImages.id, id))
    .then((r) => r[0]);

  return row && row.ownerUserId === userId ? row.image : null;
}
