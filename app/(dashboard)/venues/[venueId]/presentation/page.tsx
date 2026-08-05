import { notFound } from "next/navigation";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { venues, designs, deliverables } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { PresentationPanel } from "./presentation-panel";

export default async function VenuePresentationPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.ownerUserId, user.id)),
  });
  if (!venue) notFound();

  const venueDesigns = await db.query.designs.findMany({ where: eq(designs.venueId, venueId) });
  const designIds = venueDesigns.map((d) => d.id);

  const existing =
    designIds.length > 0
      ? await db
          .select()
          .from(deliverables)
          .where(inArray(deliverables.designId, designIds))
          .orderBy(desc(deliverables.createdAt))
      : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — presentation</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        A client-facing PDF bundling your decorated renders, moodboard, and bill of materials.
      </p>
      <div className="mt-6">
        <PresentationPanel venueId={venueId} initialDeliverables={existing} />
      </div>
    </div>
  );
}
