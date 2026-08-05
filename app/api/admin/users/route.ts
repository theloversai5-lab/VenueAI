import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/auth";
import { getAdminUserList } from "@/lib/admin";

export async function GET() {
  const user = await getOrCreateAppUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await getAdminUserList();
  return NextResponse.json({ users });
}
