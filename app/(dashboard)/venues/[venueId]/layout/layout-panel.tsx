"use client";

import { useState } from "react";

export type LayoutElement = {
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

type Layout = {
  id: string;
  elements: LayoutElement[];
};

const CANVAS = 600;

function elementColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("walkway") || t.includes("path")) return "rgba(230,198,178,0.15)";
  if (t.includes("table") || t.includes("dining")) return "rgba(230,198,178,0.5)";
  if (t.includes("chair")) return "rgba(230,198,178,0.35)";
  if (t.includes("stage") || t.includes("mandap")) return "rgba(255,255,255,0.4)";
  if (t.includes("bar")) return "rgba(180,140,255,0.4)";
  return "rgba(255,255,255,0.2)";
}

export function LayoutPanel({ venueId, initialLayout }: { venueId: string; initialLayout: Layout | null }) {
  const [layout, setLayout] = useState(initialLayout);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/venues/${venueId}/generate-layout`, { method: "POST" });
    if (res.ok) {
      const { layout } = await res.json();
      setLayout(layout);
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to generate a layout.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Layout generation failed. Try again.");
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
        {generating ? "Generating…" : layout ? "Regenerate layout" : "Generate layout"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {layout ? (
        <div className="glass-card rounded-xl p-4">
          <svg viewBox={`0 0 ${CANVAS} ${CANVAS}`} className="w-full rounded-lg bg-black/30">
            {layout.elements.map((el, i) => (
              <g
                key={i}
                transform={
                  el.rotation
                    ? `rotate(${el.rotation} ${(el.x + el.width / 2) * CANVAS} ${(el.y + el.height / 2) * CANVAS})`
                    : undefined
                }
              >
                <rect
                  x={el.x * CANVAS}
                  y={el.y * CANVAS}
                  width={el.width * CANVAS}
                  height={el.height * CANVAS}
                  fill={elementColor(el.type)}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={1}
                  rx={4}
                />
                <text
                  x={(el.x + el.width / 2) * CANVAS}
                  y={(el.y + el.height / 2) * CANVAS}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#e8e6e3"
                >
                  {el.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">No layout generated yet.</p>
      )}
    </div>
  );
}
