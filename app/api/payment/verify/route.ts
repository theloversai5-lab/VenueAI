import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { payments, wallets, creditTransactions } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";

const bodySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

export async function POST(req: Request) {
  const user = await getOrCreateAppUser();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.razorpayOrderId, razorpay_order_id), eq(payments.userId, user.id)),
  });
  if (!payment) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (payment.status === "paid") return NextResponse.json({ ok: true, alreadyProcessed: true });

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "paid", razorpayPaymentId: razorpay_payment_id })
      .where(eq(payments.id, payment.id));

    await tx
      .update(wallets)
      .set({
        balanceCredits: sql`${wallets.balanceCredits} + ${payment.creditsGranted}`,
        lifetimeAddedCredits: sql`${wallets.lifetimeAddedCredits} + ${payment.creditsGranted}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, user.id));

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "purchase",
      credits: payment.creditsGranted,
      reason: `Razorpay payment ${razorpay_payment_id}`,
      relatedPaymentId: payment.id,
    });
  });

  return NextResponse.json({ ok: true });
}
