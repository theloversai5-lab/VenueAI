import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { venues, referenceImages, designComponents } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { ReferencesGallery } from "./references-gallery";

export default async function VenueReferencesPage({
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

  const images = await db.query.referenceImages.findMany({
    where: eq(referenceImages.venueId, venueId),
    orderBy: desc(referenceImages.uploadedAt),
  });

  const counts = await db
    .select({
      referenceImageId: designComponents.referenceImageId,
      count: sql<number>`count(*)`,
    })
    .from(designComponents)
    .where(eq(designComponents.venueId, venueId))
    .groupBy(designComponents.referenceImageId);
  const countByImageId = new Map(counts.map((c) => [c.referenceImageId, Number(c.count)]));

  const imagesWithCounts = images.map((image) => ({
    ...image,
    componentCount: countByImageId.get(image.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="heading-font text-3xl text-white">{venue.name} — references</h1>
        <Link href={`/venues/${venue.id}/components`} className="text-sm text-loverai-gold hover:underline">
          Component library →
        </Link>
      </div>
      <div className="mt-6">
        <ReferencesGallery venueId={venue.id} initialImages={imagesWithCounts} />
      </div>
    </div>
  );
}
