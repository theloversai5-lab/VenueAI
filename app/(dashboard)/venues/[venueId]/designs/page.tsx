import { notFound } from "next/navigation";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { venues, venueImages, venueImageAnalysis, referenceImages, renders } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { DesignsPanel } from "./designs-panel";

export default async function VenueDesignsPage({
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

  const analyzedImages = await db
    .select({ image: venueImages, analysis: venueImageAnalysis })
    .from(venueImages)
    .innerJoin(venueImageAnalysis, eq(venueImageAnalysis.venueImageId, venueImages.id))
    .where(eq(venueImages.venueId, venueId));

  const referenceCountByArea = new Map<string, number>();
  if (analyzedImages.length > 0) {
    const refs = await db.query.referenceImages.findMany({
      where: eq(referenceImages.venueId, venueId),
    });
    for (const r of refs) {
      if (!r.area) continue;
      referenceCountByArea.set(r.area, (referenceCountByArea.get(r.area) ?? 0) + 1);
    }
  }

  const imageIds = analyzedImages.map((a) => a.image.id);
  const existingRenders =
    imageIds.length > 0
      ? await db
          .select()
          .from(renders)
          .where(inArray(renders.venueImageId, imageIds))
          .orderBy(desc(renders.createdAt))
      : [];

  const rendersByImageId = new Map<string, typeof existingRenders>();
  for (const render of existingRenders) {
    const list = rendersByImageId.get(render.venueImageId) ?? [];
    list.push(render);
    rendersByImageId.set(render.venueImageId, list);
  }

  const panelItems = analyzedImages.map(({ image, analysis }) => ({
    venueImageId: image.id,
    blobUrl: image.blobUrl,
    zoneLabel: analysis.zoneLabel,
    referenceCount: analysis.zoneLabel ? (referenceCountByArea.get(analysis.zoneLabel) ?? 0) : 0,
    renders: rendersByImageId.get(image.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — designs</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        Generate a first-pass decorated render for each analyzed venue photo, using its matched
        reference images as style conditioning.
      </p>

      {panelItems.length === 0 ? (
        <p className="mt-10 text-[color:var(--text-muted)]">
          No analyzed venue photos yet — run &quot;Analyze scene&quot; on a photo first.
        </p>
      ) : (
        <div className="mt-8">
          <DesignsPanel items={panelItems} />
        </div>
      )}
    </div>
  );
}
