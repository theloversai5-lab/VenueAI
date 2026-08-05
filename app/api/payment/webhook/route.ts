import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, wallets, creditTransactions } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured") {
    return NextResponse.json({ received: true });
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId: string | undefined = paymentEntity?.order_id;
  const paymentId: string | undefined = paymentEntity?.id;
  const userId: string | undefined = paymentEntity?.notes?.userId;
  if (!orderId || !paymentId || !userId) {
    return NextResponse.json({ received: true });
  }

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.razorpayOrderId, orderId), eq(payments.userId, userId)),
  });
  if (!payment || payment.status === "paid") {
    return NextResponse.json({ received: true });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "paid", razorpayPaymentId: paymentId })
      .where(eq(payments.id, payment.id));

    await tx
      .update(wallets)
      .set({
        balanceCredits: sql`${wallets.balanceCredits} + ${payment.creditsGranted}`,
        lifetimeAddedCredits: sql`${wallets.lifetimeAddedCredits} + ${payment.creditsGranted}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));

    await tx.insert(creditTransactions).values({
      userId,
      type: "purchase",
      credits: payment.creditsGranted,
      reason: `Razorpay webhook payment ${paymentId}`,
      relatedPaymentId: payment.id,
    });
  });

  return NextResponse.json({ received: true });
}
