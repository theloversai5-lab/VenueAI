import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { venues, designs, layouts } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { LayoutPanel, type LayoutElement } from "./layout-panel";

export default async function VenueLayoutPage({
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

  let latestLayout = null;
  if (designIds.length > 0) {
    const rows = await db.query.layouts.findMany({
      where: (l, { inArray }) => inArray(l.designId, designIds),
      orderBy: desc(layouts.createdAt),
      limit: 1,
    });
    latestLayout = rows[0] ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — layout</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        A top-down guest-flow plan generated from your venue&apos;s analyzed areas and component
        library.
      </p>
      <div className="mt-6">
        <LayoutPanel
          venueId={venueId}
          initialLayout={
            latestLayout ? { id: latestLayout.id, elements: latestLayout.elements as LayoutElement[] } : null
          }
        />
      </div>
    </div>
  );
}
