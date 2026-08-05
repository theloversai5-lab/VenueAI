"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { UploadDropzone } from "@/components/upload-dropzone";
import { AREA_OPTIONS, AREA_LABELS, type Area } from "@/lib/areas";

type ReferenceImage = {
  id: string;
  blobUrl: string;
  area: string | null;
  areaSource: string | null;
  styleTags: string[] | null;
};

export function ReferencesGallery({
  venueId,
  initialImages,
}: {
  venueId: string;
  initialImages: ReferenceImage[];
}) {
  const [images, setImages] = useState(initialImages);
  const [filter, setFilter] = useState<"all" | Area>("all");
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? images : images.filter((i) => i.area === filter)),
    [images, filter],
  );

  async function handleUploaded(result: { blobUrl: string; blobPathname: string }) {
    const res = await fetch("/api/reference-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, blobUrl: result.blobUrl, blobPathname: result.blobPathname }),
    });
    if (res.ok) {
      const { image } = await res.json();
      setImages((prev) => [image, ...prev]);
    }
  }

  async function handleAreaChange(id: string, area: Area) {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, area, areaSource: "manual" } : i)));
    await fetch(`/api/reference-images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area }),
    });
  }

  async function handleClassify(id: string) {
    setClassifyingId(id);
    setError(null);
    const res = await fetch(`/api/reference-images/${id}/classify`, { method: "POST" });
    if (res.ok) {
      const { image } = await res.json();
      setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...image } : i)));
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to classify more references.");
    } else {
      setError("Classification failed. Try again.");
    }
    setClassifyingId(null);
  }

  async function handleDelete(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/reference-images/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <UploadDropzone venueId={venueId} kind="references" onUploaded={handleUploaded} />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs ${filter === "all" ? "bg-loverai-gold text-loverai-deep" : "glass-input"}`}
        >
          All
        </button>
        {AREA_OPTIONS.map((area) => (
          <button
            key={area}
            onClick={() => setFilter(area)}
            className={`rounded-full px-3 py-1 text-xs ${filter === area ? "bg-loverai-gold text-loverai-deep" : "glass-input"}`}
          >
            {AREA_LABELS[area]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {visible.map((image) => (
          <div key={image.id} className="glass-card group relative overflow-hidden rounded-lg pb-9">
            <Image
              src={image.blobUrl}
              alt={image.area ?? "reference"}
              width={400}
              height={300}
              className="h-40 w-full object-cover"
              unoptimized
            />
            <button
              onClick={() => handleDelete(image.id)}
              className="absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              Delete
            </button>
            {!image.area && (
              <button
                onClick={() => handleClassify(image.id)}
                disabled={classifyingId === image.id}
                className="absolute left-2 top-2 rounded bg-loverai-gold px-2 py-0.5 text-xs font-medium text-loverai-deep disabled:opacity-50"
              >
                {classifyingId === image.id ? "Classifying…" : "AI classify"}
              </button>
            )}
            {image.styleTags && image.styleTags.length > 0 && (
              <div className="px-2 pt-2 flex flex-wrap gap-1">
                {image.styleTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <select
              value={image.area ?? ""}
              onChange={(e) => handleAreaChange(image.id, e.target.value as Area)}
              className="glass-input absolute bottom-2 left-2 right-2 rounded px-2 py-1 text-xs"
            >
              <option value="" disabled>
                Tag area…
              </option>
              {AREA_OPTIONS.map((area) => (
                <option key={area} value={area}>
                  {AREA_LABELS[area]}
                  {image.area === area && image.areaSource === "ai_suggested" ? " (AI)" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
