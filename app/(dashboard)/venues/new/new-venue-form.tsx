"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldClass = "glass-input mt-1 w-full rounded-lg px-3 py-2";

export function NewVenueForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        address: form.get("address") || undefined,
        eventType: form.get("eventType") || undefined,
        guestCount: form.get("guestCount") || undefined,
        budget: form.get("budget") || undefined,
      }),
    });
    if (!res.ok) {
      setError("Please check the form and try again.");
      setSubmitting(false);
      return;
    }
    const { venue } = await res.json();
    router.push(`/venues/${venue.id}/setup`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm text-[color:var(--text-secondary)]">Venue name</label>
        <input name="name" required className={fieldClass} placeholder="The Grand Lawn" />
      </div>
      <div>
        <label className="text-sm text-[color:var(--text-secondary)]">Address</label>
        <input name="address" className={fieldClass} placeholder="City, area" />
      </div>
      <div>
        <label className="text-sm text-[color:var(--text-secondary)]">Event type</label>
        <input name="eventType" className={fieldClass} placeholder="Wedding, corporate, ..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-[color:var(--text-secondary)]">Guest count</label>
          <input name="guestCount" type="number" min={1} className={fieldClass} />
        </div>
        <div>
          <label className="text-sm text-[color:var(--text-secondary)]">Budget (₹)</label>
          <input name="budget" type="number" min={0} className={fieldClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-lg bg-loverai-gold px-4 py-2 font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create venue"}
      </button>
    </form>
  );
}
