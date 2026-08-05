import { NextResponse } from "next/server";
import { CREDIT_PACKS } from "@/lib/billing";

export async function GET() {
  return NextResponse.json({ plans: CREDIT_PACKS });
}
