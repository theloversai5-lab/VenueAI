import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { designs } from "@/db/schema";

// Phase 5's UI only needs one design "in progress" per venue at a time —
// reuse the most recent non-complete one rather than prompting the user to
// name/manage multiple designs, which is a Phase 7+ concern.
export async function getOrCreateDraftDesign(venueId: string) {
  const existing = await db.query.designs.findFirst({
    where: and(eq(designs.venueId, venueId), inArray(designs.status, ["draft", "in_progress"])),
    orderBy: desc(designs.createdAt),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(designs)
    .values({ venueId, status: "in_progress" })
    .returning();
  return created;
}
