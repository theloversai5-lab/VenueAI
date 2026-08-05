import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq, inArray, sql } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { venues, designs, renders, referenceImages, designComponents, deliverables } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { PresentationDocument, type PresentationData } from "@/lib/pdf/presentation-document";

export async function POST(_req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await getOrCreateAppUser();
  const venue = await db.query.venues.findFirst({
    where: and(eq(venues.id, venueId), eq(venues.ownerUserId, user.id)),
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const venueDesigns = await db.query.designs.findMany({ where: eq(designs.venueId, venueId) });
  const designIds = venueDesigns.map((d) => d.id);

  const succeededRenders =
    designIds.length > 0
      ? await db.query.renders.findMany({
          where: and(inArray(renders.designId, designIds), eq(renders.status, "succeeded")),
        })
      : [];

  const references = await db.query.referenceImages.findMany({
    where: eq(referenceImages.venueId, venueId),
  });
  const referencesByAreaMap = new Map<string, { blobUrl: string; styleTags: string[] | null }[]>();
  for (const r of references) {
    if (!r.area) continue;
    const list = referencesByAreaMap.get(r.area) ?? [];
    list.push({ blobUrl: r.blobUrl, styleTags: r.styleTags });
    referencesByAreaMap.set(r.area, list);
  }

  const bomRows = await db
    .select({ category: designComponents.category, count: sql<number>`count(*)` })
    .from(designComponents)
    .where(eq(designComponents.venueId, venueId))
    .groupBy(designComponents.category);

  if (succeededRenders.length === 0 && references.length === 0) {
    return NextResponse.json(
      { error: "Nothing to present yet — upload references and generate at least one render first" },
      { status: 400 },
    );
  }

  const data: PresentationData = {
    venueName: venue.name,
    eventType: venue.eventType,
    guestCount: venue.guestCount,
    renders: succeededRenders.map((r) => ({ blobUrl: r.resultBlobUrl!, area: r.area })),
    referencesByArea: [...referencesByAreaMap.entries()].map(([area, images]) => ({ area, images })),
    bom: bomRows.map((b) => ({ category: b.category, count: Number(b.count) })),
  };

  const buffer = await renderToBuffer(<PresentationDocument data={data} />);

  const design = venueDesigns[0] ?? (await db.insert(designs).values({ venueId }).returning())[0];

  const blob = await put(`venues/${venueId}/deliverables/presentation-${Date.now()}.pdf`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/pdf",
  });

  const [deliverable] = await db
    .insert(deliverables)
    .values({
      designId: design.id,
      type: "presentation_pdf",
      blobUrl: blob.url,
      metadata: { renderCount: succeededRenders.length, referenceCount: references.length },
    })
    .returning();

  return NextResponse.json({ deliverable });
}
