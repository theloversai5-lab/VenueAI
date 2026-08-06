"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { blobPathname } from "@/lib/blob";

export type CardImage = { blobUrl: string; blobPathname: string };

export function AngleUploadCard({
  venueId,
  cardKey,
  label,
  hint,
  kind,
  images,
  onAdd,
}: {
  venueId: string;
  cardKey: string;
  label: string;
  hint: string;
  kind: "photos" | "references";
  images: CardImage[];
  onAdd: (cardKey: string, image: CardImage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const pathname = blobPathname(venueId, kind, `${cardKey}-${file.name}`);
        const uploaded = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ venueId }),
        });
        onAdd(cardKey, { blobUrl: uploaded.url, blobPathname: uploaded.pathname });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <motion.div
      layout
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className="glass-card flex min-h-[140px] cursor-pointer flex-col overflow-hidden rounded-xl border border-dashed border-white/15 p-3 transition hover:border-loverai-gold/50"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-sm font-medium text-loverai-gold">{label}</p>
      <p className="text-[10px] text-[color:var(--text-muted)]">{hint}</p>

      {images.length > 0 ? (
        <div className="mt-2 grid flex-1 grid-cols-3 gap-1">
          {images.map((img) => (
            <motion.div key={img.blobUrl} layoutId={img.blobUrl} className="relative aspect-square overflow-hidden rounded">
              <Image src={img.blobUrl} alt={label} fill sizes="80px" className="object-cover" unoptimized />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-1 items-center justify-center text-[11px] text-[color:var(--text-dim)]">
          {uploading ? "Uploading…" : "Click or drop"}
        </div>
      )}
    </motion.div>
  );
}
