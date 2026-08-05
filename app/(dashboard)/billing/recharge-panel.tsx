"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKS } from "@/lib/billing";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export function RechargePanel() {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRazorpayScript();
  }, []);

  async function handleBuy(planId: string) {
    setLoadingPlanId(planId);
    setError(null);
    try {
      await loadRazorpayScript();
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!orderRes.ok) throw new Error("Could not create order");
      const order = await orderRes.json();

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "VenueAI",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verifyRes.ok) window.location.reload();
        },
      });
      razorpay.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed to start");
    } finally {
      setLoadingPlanId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {CREDIT_PACKS.map((plan) => (
        <div key={plan.id} className="glass-card flex items-center justify-between rounded-xl p-4">
          <div>
            <p className="font-medium text-white">{plan.name}</p>
            <p className="text-sm text-[color:var(--text-muted)]">
              {plan.credits} credits · ₹{(plan.priceInr / 100).toLocaleString("en-IN")}
            </p>
          </div>
          <button
            onClick={() => handleBuy(plan.id)}
            disabled={loadingPlanId === plan.id}
            className="rounded-lg bg-loverai-gold px-4 py-1.5 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
          >
            {loadingPlanId === plan.id ? "…" : "Buy"}
          </button>
        </div>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
