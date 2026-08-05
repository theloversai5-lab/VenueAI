import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";

const bodySchema = z.object({
  phoneNumber: z.string().min(6).max(20),
  companyName: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ phoneNumber: parsed.data.phoneNumber, companyName: parsed.data.companyName })
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({ user: updated });
}
