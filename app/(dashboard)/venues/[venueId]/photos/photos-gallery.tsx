"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadDropzone } from "@/components/upload-dropzone";
import { AREA_LABELS, type Area } from "@/lib/areas";

type VenueImage = {
  id: string;
  blobUrl: string;
  angleLabel: string | null;
  zoneLabel: string | null;
  obstacleCount: number;
};

const ANGLE_OPTIONS = ["front", "aerial", "satellite", "interior", "other"] as const;

export function PhotosGallery({
  venueId,
  initialImages,
}: {
  venueId: string;
  initialImages: VenueImage[];
}) {
  const [images, setImages] = useState(initialImages);
  const [pendingAngle, setPendingAngle] = useState<string>("front");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUploaded(result: { blobUrl: string; blobPathname: string }) {
    const res = await fetch("/api/venue-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueId,
        blobUrl: result.blobUrl,
        blobPathname: result.blobPathname,
        angleLabel: pendingAngle,
      }),
    });
    if (res.ok) {
      const { image } = await res.json();
      setImages((prev) => [{ ...image, zoneLabel: null, obstacleCount: 0 }, ...prev]);
    }
  }

  async function handleAnalyze(id: string) {
    setAnalyzingId(id);
    setError(null);
    const res = await fetch(`/api/venue-images/${id}/analyze-scene`, { method: "POST" });
    if (res.ok) {
      const { analysis } = await res.json();
      setImages((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, zoneLabel: analysis.zoneLabel, obstacleCount: (analysis.obstacles ?? []).length }
            : i,
        ),
      );
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to analyze more photos.");
    } else {
      setError("Scene analysis failed. Try again.");
    }
    setAnalyzingId(null);
  }

  async function handleDelete(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/venue-images/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-[color:var(--text-secondary)]">Angle for next upload</label>
        <select
          value={pendingAngle}
          onChange={(e) => setPendingAngle(e.target.value)}
          className="glass-input rounded-lg px-2 py-1 text-sm"
        >
          {ANGLE_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <UploadDropzone venueId={venueId} kind="photos" onUploaded={handleUploaded} />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {images.map((image) => (
          <div key={image.id} className="glass-card group relative overflow-hidden rounded-lg pb-9">
            <Image
              src={image.blobUrl}
              alt={image.angleLabel ?? "venue photo"}
              width={400}
              height={300}
              className="h-40 w-full object-cover"
              unoptimized
            />
            <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
              {image.angleLabel ?? "unlabeled"}
            </span>
            <button
              onClick={() => handleDelete(image.id)}
              className="absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              Delete
            </button>
            <div className="px-2 pt-2 text-xs">
              {image.zoneLabel ? (
                <span className="text-loverai-gold">
                  {AREA_LABELS[image.zoneLabel as Area] ?? image.zoneLabel}
                  {image.obstacleCount > 0 && (
                    <span className="text-[color:var(--text-muted)]"> · {image.obstacleCount} obstacle(s)</span>
                  )}
                </span>
              ) : (
                <button
                  onClick={() => handleAnalyze(image.id)}
                  disabled={analyzingId === image.id}
                  className="text-[color:var(--text-muted)] hover:text-loverai-gold disabled:opacity-50"
                >
                  {analyzingId === image.id ? "Analyzing…" : "Analyze scene"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
