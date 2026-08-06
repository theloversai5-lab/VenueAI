import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/auth";
import { analyzeVenueImageScene, PipelineError } from "@/lib/pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateAppUser();

  try {
    const analysis = await analyzeVenueImageScene(user.id, id);
    return NextResponse.json({ analysis });
  } catch (e) {
    if (e instanceof PipelineError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
