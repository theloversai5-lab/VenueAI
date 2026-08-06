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
    <div className="mx-auto flex h-[calc(100vh-9.5rem)] min-h-[560px] max-w-6xl flex-col">
      <h1 className="heading-font shrink-0 text-2xl text-white">{venue.name} — quick setup</h1>
      <div className="mt-4 min-h-0 flex-1">
        <SetupAssistant venueId={venueId} />
      </div>
    </div>
  );
}
