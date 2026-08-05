"use client";

import { useState } from "react";
import Image from "next/image";
import { AREA_LABELS, type Area } from "@/lib/areas";

type Render = {
  id: string;
  status: string;
  resultBlobUrl: string | null;
  errorMessage: string | null;
  jobType: string;
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
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [selectedRenderId, setSelectedRenderId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRender(venueImageId: string, render: Render) {
    setItems((prev) =>
      prev.map((i) => (i.venueImageId === venueImageId ? { ...i, renders: [render, ...i.renders] } : i)),
    );
  }

  async function handleGenerate(venueImageId: string) {
    setGeneratingId(venueImageId);
    setError(null);
    const res = await fetch(`/api/venue-images/${venueImageId}/generate-render`, { method: "POST" });
    if (res.ok) {
      const { render } = await res.json();
      addRender(venueImageId, render);
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to generate more renders.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Render generation failed. Try again.");
    }
    setGeneratingId(null);
  }

  async function handleRefine(venueImageId: string, renderId: string) {
    setRefiningId(renderId);
    setError(null);
    const res = await fetch(`/api/renders/${renderId}/refine`, { method: "POST" });
    if (res.ok) {
      const { render } = await res.json();
      addRender(venueImageId, render);
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to refine more renders.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Refinement failed. Try again.");
    }
    setRefiningId(null);
  }

  async function handleSubmitFeedback(venueImageId: string) {
    if (!selectedRenderId || !feedbackText.trim()) return;
    setSubmittingFeedback(true);
    setError(null);
    const res = await fetch(`/api/renders/${selectedRenderId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: feedbackText.trim() }),
    });
    if (res.ok) {
      const { render } = await res.json();
      addRender(venueImageId, render);
      setFeedbackText("");
      setSelectedRenderId(null);
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to apply feedback.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Feedback couldn't be applied. Try again.");
    }
    setSubmittingFeedback(false);
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
                <div
                  key={render.id}
                  className={`group relative overflow-hidden rounded-lg border ${
                    selectedRenderId === render.id ? "border-loverai-gold" : "border-white/10"
                  }`}
                >
                  {render.status === "succeeded" && render.resultBlobUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedRenderId(render.id === selectedRenderId ? null : render.id)}
                        className="block w-full"
                      >
                        <Image
                          src={render.resultBlobUrl}
                          alt="Generated render"
                          width={300}
                          height={220}
                          className="h-28 w-full object-cover"
                          unoptimized
                        />
                      </button>
                      {render.jobType === "perspective_correction" && (
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-loverai-gold">
                          refined
                        </span>
                      )}
                      <button
                        onClick={() => handleRefine(item.venueImageId, render.id)}
                        disabled={refiningId === render.id}
                        className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
                      >
                        {refiningId === render.id ? "Refining…" : "Refine"}
                      </button>
                    </>
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

          {selectedRenderId && item.renders.some((r) => r.id === selectedRenderId) && (
            <div className="mt-4 flex gap-2">
              <input
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder='e.g. "less disco balls, warmer lighting"'
                className="glass-input flex-1 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleSubmitFeedback(item.venueImageId)}
                disabled={submittingFeedback || !feedbackText.trim()}
                className="rounded-lg bg-loverai-gold px-3 py-2 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
              >
                {submittingFeedback ? "Applying…" : "Apply feedback"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
