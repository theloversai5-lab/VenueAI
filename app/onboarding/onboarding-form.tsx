"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, companyName }),
    });
    if (!res.ok) {
      setError("Please check your details and try again.");
      setSubmitting(false);
      return;
    }
    router.push("/venues");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="text-sm text-[color:var(--text-secondary)]">Phone number</label>
        <input
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="glass-input mt-1 w-full rounded-lg px-3 py-2"
          placeholder="+91 98765 43210"
        />
      </div>
      <div>
        <label className="text-sm text-[color:var(--text-secondary)]">Company name</label>
        <input
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="glass-input mt-1 w-full rounded-lg px-3 py-2"
          placeholder="Your decor studio"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-loverai-gold px-4 py-2 font-medium text-loverai-deep transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
