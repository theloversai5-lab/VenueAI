import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

export default async function VenuesPage() {
  const user = await getOrCreateAppUser();
  const rows = await db.query.venues.findMany({
    where: eq(venues.ownerUserId, user.id),
    orderBy: desc(venues.createdAt),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="heading-font text-3xl text-white">Your venues</h1>
        <Link
          href="/venues/new"
          className="rounded-lg bg-loverai-gold px-4 py-2 text-sm font-medium text-loverai-deep hover:opacity-90"
        >
          + New venue
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-[color:var(--text-muted)]">
          No venues yet. Create one to start uploading photos and references.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((venue) => (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="glass-card animate-fade-in-up rounded-xl p-5 transition hover:border-white/30"
            >
              <h2 className="heading-font text-lg text-loverai-gold">{venue.name}</h2>
              {venue.address && (
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{venue.address}</p>
              )}
              <div className="mt-3 flex gap-3 text-xs text-[color:var(--text-secondary)]">
                {venue.eventType && <span>{venue.eventType}</span>}
                {venue.guestCount && <span>{venue.guestCount} guests</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
