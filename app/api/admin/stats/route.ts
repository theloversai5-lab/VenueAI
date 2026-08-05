import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";

export async function GET() {
  const user = await getOrCreateAppUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stats = await getAdminStats();
  return NextResponse.json({ stats });
}
