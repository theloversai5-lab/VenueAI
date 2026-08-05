import { eq } from "drizzle-orm";
import { db } from "@/db";
import { venueImages, venues } from "@/db/schema";

export async function getOwnedVenueImage(userId: string, id: string) {
  const row = await db
    .select({ image: venueImages, ownerUserId: venues.ownerUserId })
    .from(venueImages)
    .innerJoin(venues, eq(venues.id, venueImages.venueId))
    .where(eq(venueImages.id, id))
    .then((r) => r[0]);

  return row && row.ownerUserId === userId ? row.image : null;
}
