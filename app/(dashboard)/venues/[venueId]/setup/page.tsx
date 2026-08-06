import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { SetupAssistant } from "./setup-assistant";

export default async function VenueSetupPage({
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
      <h1 className="heading-font text-3xl text-white">{venue.name} — quick setup</h1>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">
        Drop in your venue photos and inspiration images together, describe what you want, and
        VenueAI will sort them out — asking if anything&apos;s unclear — then generate your first
        renders.
      </p>
      <div className="mt-6">
        <SetupAssistant venueId={venueId} />
      </div>
    </div>
  );
}
