import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const user = await getOrCreateAppUser();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? (JSON.parse(clientPayload) as { venueId: string }) : null;
        if (!payload?.venueId) throw new Error("Missing upload clientPayload");

        const venue = await db.query.venues.findFirst({
          where: and(eq(venues.id, payload.venueId), eq(venues.ownerUserId, user.id)),
        });
        if (!venue) throw new Error("Venue not found or not owned by the current user");

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {
        // DB row is persisted by the client via api/venue-images or
        // api/reference-images after upload() resolves, not here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload token generation failed" },
      { status: 400 },
    );
  }
}
