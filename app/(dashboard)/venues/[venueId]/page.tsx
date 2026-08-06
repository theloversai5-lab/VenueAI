import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

export default async function VenueOverviewPage({
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="heading-font text-3xl text-white">{venue.name}</h1>
      <div className="mt-2 flex gap-3 text-sm text-[color:var(--text-muted)]">
        {venue.address && <span>{venue.address}</span>}
        {venue.eventType && <span>· {venue.eventType}</span>}
        {venue.guestCount && <span>· {venue.guestCount} guests</span>}
      </div>

      <Link
        href={`/venues/${venue.id}/setup`}
        className="glass-card-strong mt-8 flex items-center justify-between rounded-xl p-6 hover:border-white/30"
      >
        <div>
          <h2 className="heading-font text-lg text-loverai-gold">Quick setup</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Drop in all your photos at once and describe what you want — VenueAI sorts and
            generates for you.
          </p>
        </div>
        <span className="text-loverai-gold">→</span>
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={`/venues/${venue.id}/photos`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Venue photos</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Upload photos of the venue from multiple angles.
          </p>
        </Link>
        <Link href={`/venues/${venue.id}/references`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Reference images</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Upload inspiration images and tag them by area.
          </p>
        </Link>
        <Link href={`/venues/${venue.id}/components`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Component library</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Decor elements extracted from your reference images.
          </p>
        </Link>
        <Link href={`/venues/${venue.id}/designs`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Designs</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Generate AI-decorated renders of your venue photos.
          </p>
        </Link>
        <Link href={`/venues/${venue.id}/layout`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Layout</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Top-down guest-flow plan for the venue.
          </p>
        </Link>
        <Link href={`/venues/${venue.id}/presentation`} className="glass-card rounded-xl p-6 hover:border-white/30">
          <h2 className="heading-font text-lg text-loverai-gold">Presentation</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Client-facing PDF: renders, moodboard, bill of materials.
          </p>
        </Link>
      </div>
    </div>
  );
}
