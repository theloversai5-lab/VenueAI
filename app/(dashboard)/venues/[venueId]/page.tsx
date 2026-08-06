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
    <div className="mx-auto max-w-2xl">
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

      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        Use the sidebar to manage photos, references, components, designs, layout, and the
        client presentation individually.
      </p>
    </div>
  );
}
