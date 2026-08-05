import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { getRazorpay } from "@/lib/razorpay";
import { CREDIT_PACKS } from "@/lib/billing";

const bodySchema = z.object({ planId: z.string() });

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const plan = CREDIT_PACKS.find((p) => p.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount: plan.priceInr,
    currency: "INR",
    receipt: `venueai_${user.id.slice(-12)}_${Date.now()}`,
    notes: { userId: user.id, planId: plan.id },
  });

  await db.insert(payments).values({
    userId: user.id,
    razorpayOrderId: order.id,
    amountInr: plan.priceInr,
    creditsGranted: plan.credits,
    status: "created",
  });

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
