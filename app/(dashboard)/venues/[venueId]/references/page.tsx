import { notFound } from "next/navigation";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { venues, referenceImages } from "@/db/schema";
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

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — references</h1>
      <div className="mt-6">
        <ReferencesGallery venueId={venue.id} initialImages={images} />
      </div>
    </div>
  );
}
