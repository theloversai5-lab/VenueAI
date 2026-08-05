"use client";

import { useState } from "react";

type Deliverable = {
  id: string;
  blobUrl: string;
  createdAt: Date | string;
};

export function PresentationPanel({
  venueId,
  initialDeliverables,
}: {
  venueId: string;
  initialDeliverables: Deliverable[];
}) {
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/venues/${venueId}/generate-presentation`, { method: "POST" });
    if (res.ok) {
      const { deliverable } = await res.json();
      setDeliverables((prev) => [deliverable, ...prev]);
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Presentation generation failed. Try again.");
    }
    setGenerating(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="self-start rounded-lg bg-loverai-gold px-4 py-2 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate presentation PDF"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {deliverables.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)]">No presentations generated yet.</p>
      ) : (
        <div className="glass-card divide-y divide-white/10 rounded-xl">
          {deliverables.map((d) => (
            <a
              key={d.id}
              href={d.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5"
            >
              <span>Presentation — {new Date(d.createdAt).toLocaleString()}</span>
              <span className="text-loverai-gold">Download →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
