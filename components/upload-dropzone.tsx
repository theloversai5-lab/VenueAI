"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { blobPathname, type UploadKind } from "@/lib/blob";

export function UploadDropzone({
  venueId,
  kind,
  onUploaded,
}: {
  venueId: string;
  kind: UploadKind;
  onUploaded: (result: { blobUrl: string; blobPathname: string }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const pathname = blobPathname(venueId, kind, file.name);
        const result = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ venueId }),
        });
        await onUploaded({ blobUrl: result.url, blobPathname: result.pathname });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFiles(e.dataTransfer.files);
      }}
      className="glass-card flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-8 text-center"
    >
      <p className="text-sm text-[color:var(--text-secondary)]">
        Drag & drop images here, or
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-lg bg-loverai-gold px-4 py-1.5 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Choose files"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
