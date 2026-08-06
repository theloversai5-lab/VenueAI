import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/auth";
import { generateRenderForVenueImage, PipelineError } from "@/lib/pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();

  try {
    const render = await generateRenderForVenueImage(user.id, id);
    return NextResponse.json({ render });
  } catch (e) {
    if (e instanceof PipelineError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
