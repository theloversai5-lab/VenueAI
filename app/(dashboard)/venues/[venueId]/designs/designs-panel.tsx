"use client";

import { useState } from "react";
import Image from "next/image";
import { AREA_LABELS, type Area } from "@/lib/areas";

type Render = {
  id: string;
  status: string;
  resultBlobUrl: string | null;
  errorMessage: string | null;
};

type PanelItem = {
  venueImageId: string;
  blobUrl: string;
  zoneLabel: string | null;
  referenceCount: number;
  renders: Render[];
};

export function DesignsPanel({ items: initialItems }: { items: PanelItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(venueImageId: string) {
    setGeneratingId(venueImageId);
    setError(null);
    const res = await fetch(`/api/venue-images/${venueImageId}/generate-render`, { method: "POST" });
    if (res.ok) {
      const { render } = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.venueImageId === venueImageId ? { ...i, renders: [render, ...i.renders] } : i)),
      );
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to generate more renders.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Render generation failed. Try again.");
    }
    setGeneratingId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items.map((item) => (
        <div key={item.venueImageId} className="glass-card rounded-xl p-4">
          <div className="flex items-start gap-4">
            <Image
              src={item.blobUrl}
              alt={item.zoneLabel ?? "venue photo"}
              width={160}
              height={120}
              className="h-24 w-32 rounded object-cover"
              unoptimized
            />
            <div className="flex-1">
              <p className="font-medium text-loverai-gold">
                {item.zoneLabel ? AREA_LABELS[item.zoneLabel as Area] ?? item.zoneLabel : "Unclassified"}
              </p>
              <p className="text-xs text-[color:var(--text-muted)]">
                {item.referenceCount} matching reference{item.referenceCount === 1 ? "" : "s"}
              </p>
              <button
                onClick={() => handleGenerate(item.venueImageId)}
                disabled={generatingId === item.venueImageId || item.referenceCount === 0}
                className="mt-2 rounded-lg bg-loverai-gold px-3 py-1.5 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
              >
                {generatingId === item.venueImageId ? "Generating…" : "Generate render"}
              </button>
            </div>
          </div>

          {item.renders.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {item.renders.map((render) => (
                <div key={render.id} className="overflow-hidden rounded-lg border border-white/10">
                  {render.status === "succeeded" && render.resultBlobUrl ? (
                    <Image
                      src={render.resultBlobUrl}
                      alt="Generated render"
                      width={300}
                      height={220}
                      className="h-28 w-full object-cover"
                      unoptimized
                    />
                  ) : render.status === "failed" ? (
                    <div className="flex h-28 w-full items-center justify-center bg-red-950/40 p-2 text-center text-[10px] text-red-300">
                      {render.errorMessage ?? "Failed"}
                    </div>
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-white/5 text-xs text-[color:var(--text-muted)]">
                      {render.status}…
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
