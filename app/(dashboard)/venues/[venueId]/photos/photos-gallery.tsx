"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadDropzone } from "@/components/upload-dropzone";

type VenueImage = {
  id: string;
  blobUrl: string;
  angleLabel: string | null;
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
      setImages((prev) => [image, ...prev]);
    }
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {images.map((image) => (
          <div key={image.id} className="glass-card group relative overflow-hidden rounded-lg">
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
          </div>
        ))}
      </div>
    </div>
  );
}
