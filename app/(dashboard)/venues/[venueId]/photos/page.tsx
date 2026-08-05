import { notFound } from "next/navigation";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { venues, venueImages, venueImageAnalysis } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { PhotosGallery } from "./photos-gallery";

export default async function VenuePhotosPage({
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

  const images = await db.query.venueImages.findMany({
    where: eq(venueImages.venueId, venueId),
    orderBy: desc(venueImages.uploadedAt),
  });

  const analyses =
    images.length > 0
      ? await db
          .select()
          .from(venueImageAnalysis)
          .where(
            inArray(
              venueImageAnalysis.venueImageId,
              images.map((i) => i.id),
            ),
          )
      : [];
  const analysisByImageId = new Map(analyses.map((a) => [a.venueImageId, a]));

  const imagesWithAnalysis = images.map((image) => ({
    ...image,
    zoneLabel: analysisByImageId.get(image.id)?.zoneLabel ?? null,
    obstacleCount: (analysisByImageId.get(image.id)?.obstacles as unknown[] | null)?.length ?? 0,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="heading-font text-3xl text-white">{venue.name} — photos</h1>
      <div className="mt-6">
        <PhotosGallery venueId={venue.id} initialImages={imagesWithAnalysis} />
      </div>
    </div>
  );
}
