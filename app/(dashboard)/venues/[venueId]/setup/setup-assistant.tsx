"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { blobPathname } from "@/lib/blob";

type UploadedImage = { blobUrl: string; blobPathname: string };
type ChatTurn = { role: "user" | "assistant"; content: string };

type SetupResult = {
  done: true;
  venueImages: { id: string; blobUrl: string; angleLabel: string | null }[];
  referenceImages: { id: string; blobUrl: string; area: string | null }[];
  renders: Array<{ id: string; status: string; resultBlobUrl: string | null } | { venueImageId: string; error: string }>;
};

export function SetupAssistant({ venueId }: { venueId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const pathname = blobPathname(venueId, "uploads", file.name);
        const uploaded = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ venueId }),
        });
        setImages((prev) => [...prev, { blobUrl: uploaded.url, blobPathname: uploaded.pathname }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function sendTurn(nextHistory: ChatTurn[]) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/venues/${venueId}/setup-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, prompt, history: nextHistory }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.done) {
        setResult(data);
        setPendingQuestion(null);
      } else {
        setHistory([...nextHistory, { role: "assistant", content: data.question }]);
        setPendingQuestion(data.question);
      }
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to run setup.");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Setup failed. Try again.");
    }
    setSubmitting(false);
  }

  async function handleStart() {
    if (images.length === 0 || !prompt.trim()) return;
    await sendTurn([]);
  }

  async function handleAnswer() {
    if (!answer.trim()) return;
    const nextHistory = [...history, { role: "user" as const, content: answer.trim() }];
    setHistory(nextHistory);
    setAnswer("");
    await sendTurn(nextHistory);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-loverai-gold">
          Sorted {result.venueImages.length} venue photo(s) and {result.referenceImages.length}{" "}
          reference(s).
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {result.renders.map((r, i) =>
            "resultBlobUrl" in r && r.resultBlobUrl ? (
              <Image
                key={i}
                src={r.resultBlobUrl}
                alt="Generated render"
                width={300}
                height={220}
                className="h-32 w-full rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <div
                key={i}
                className="flex h-32 w-full items-center justify-center rounded-lg bg-red-950/40 p-2 text-center text-[10px] text-red-300"
              >
                {"error" in r ? r.error : "Failed"}
              </div>
            ),
          )}
        </div>
        <Link href={`/venues/${venueId}/designs`} className="text-sm text-loverai-gold hover:underline">
          Open full designs view →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!pendingQuestion && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
            className="glass-card flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-8 text-center"
          >
            <p className="text-sm text-[color:var(--text-secondary)]">
              Drag & drop all your venue photos and inspiration images together
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
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((img, i) => (
                <Image
                  key={i}
                  src={img.blobUrl}
                  alt="Uploaded"
                  width={100}
                  height={80}
                  className="h-16 w-full rounded object-cover"
                  unoptimized
                />
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='Describe what you want, e.g. "wedding mandap, gold and white theme, 200 guests"'
            rows={3}
            className="glass-input rounded-lg px-3 py-2 text-sm"
          />

          <button
            onClick={handleStart}
            disabled={submitting || images.length === 0 || !prompt.trim()}
            className="self-start rounded-lg bg-loverai-gold px-4 py-2 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Thinking…" : "Start setup"}
          </button>
        </>
      )}

      {pendingQuestion && (
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-loverai-gold">{pendingQuestion}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnswer()}
              className="glass-input flex-1 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <button
              onClick={handleAnswer}
              disabled={submitting || !answer.trim()}
              className="rounded-lg bg-loverai-gold px-3 py-2 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "…" : "Reply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
