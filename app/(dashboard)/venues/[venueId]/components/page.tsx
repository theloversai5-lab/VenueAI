import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { venues, designComponents, referenceImages } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { cssCropStyle } from "@/lib/crop";

export default async function VenueComponentsPage({
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

  const rows = await db
    .select({ component: designComponents, referenceBlobUrl: referenceImages.blobUrl })
    .from(designComponents)
    .innerJoin(referenceImages, eq(referenceImages.id, designComponents.referenceImageId))
    .where(eq(designComponents.venueId, venueId))
    .orderBy(desc(designComponents.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — component library</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        Decor elements extracted from your reference images. Run &quot;Extract components&quot; on a
        reference image to add more.
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 text-[color:var(--text-muted)]">
          No components extracted yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {rows.map(({ component, referenceBlobUrl }) => {
            const box = component.boundingBox as { x: number; y: number; width: number; height: number };
            const attrs = (component.attributes ?? {}) as {
              material?: string;
              colorPalette?: string[];
              sizeClass?: string;
            };
            return (
              <div key={component.id} className="glass-card overflow-hidden rounded-lg">
                <div className="h-32 w-full" style={cssCropStyle(box, referenceBlobUrl)} />
                <div className="p-2">
                  <p className="text-sm font-medium capitalize text-loverai-gold">{component.category}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[color:var(--text-muted)]">
                    {attrs.material && <span>{attrs.material}</span>}
                    {attrs.sizeClass && <span>· {attrs.sizeClass}</span>}
                  </div>
                  {attrs.colorPalette && attrs.colorPalette.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {attrs.colorPalette.map((c) => (
                        <span key={c} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
