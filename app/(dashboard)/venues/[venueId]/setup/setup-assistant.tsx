"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { AngleUploadCard, type CardImage } from "./angle-upload-card";
import { ANGLE_OPTIONS } from "@/lib/angles";

const CARD_DEFS = [
  { key: "front", label: "Front", hint: "Main entrance view", kind: "photos" as const },
  { key: "aerial", label: "Aerial", hint: "Drone / top-down", kind: "photos" as const },
  { key: "satellite", label: "Satellite", hint: "Google Maps view", kind: "photos" as const },
  { key: "interior", label: "Interior", hint: "Inside the space", kind: "photos" as const },
  { key: "other", label: "Other angle", hint: "Anything else useful", kind: "photos" as const },
  { key: "inspiration", label: "Inspiration", hint: "Decor styles you like", kind: "references" as const },
];

type ChatTurn = { role: "user" | "assistant"; content: string };
type Stage = "collecting" | "generating" | "question" | "done";

type SetupResult = {
  venueImages: { id: string; blobUrl: string; angleLabel: string | null }[];
  referenceImages: { id: string; blobUrl: string; area: string | null }[];
  renders: Array<{ id: string; status: string; resultBlobUrl: string | null } | { venueImageId: string; error: string }>;
};

export function SetupAssistant({ venueId }: { venueId: string }) {
  const [cardImages, setCardImages] = useState<Record<string, CardImage[]>>({});
  const [prompt, setPrompt] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [stage, setStage] = useState<Stage>("collecting");
  const [question, setQuestion] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalImages = Object.values(cardImages).reduce((n, arr) => n + arr.length, 0);

  function addImage(cardKey: string, image: CardImage) {
    setCardImages((prev) => ({ ...prev, [cardKey]: [...(prev[cardKey] ?? []), image] }));
  }

  function flattenImages() {
    return CARD_DEFS.flatMap((card) =>
      (cardImages[card.key] ?? []).map((img) => ({
        ...img,
        presetKind: card.kind === "photos" ? ("venue" as const) : ("reference" as const),
        presetAngle: card.kind === "photos" ? (card.key as (typeof ANGLE_OPTIONS)[number]) : undefined,
      })),
    );
  }

  async function sendTurn(nextHistory: ChatTurn[]) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/venues/${venueId}/setup-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: flattenImages(), prompt, history: nextHistory }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.done) {
        setResult(data);
        setStage("done");
        setQuestion(null);
      } else {
        setHistory([...nextHistory, { role: "assistant", content: data.question }]);
        setQuestion(data.question);
        setStage("question");
      }
    } else if (res.status === 402) {
      setError("Not enough credits — recharge in Billing to run setup.");
      setStage("question");
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Setup failed. Try again.");
      setStage("question");
    }
    setSubmitting(false);
  }

  async function handleSend() {
    if (!chatInput.trim() || submitting) return;

    if (stage === "collecting") {
      if (totalImages === 0) {
        setError("Add at least one photo before sending.");
        return;
      }
      setPrompt(chatInput.trim());
      setChatInput("");
      setStage("generating");
      await sendTurn([]);
      return;
    }

    // Answering a clarifying question
    const nextHistory = [...history, { role: "user" as const, content: chatInput.trim() }];
    setHistory(nextHistory);
    setChatInput("");
    setStage("generating");
    await sendTurn(nextHistory);
  }

  const sidebarImages = flattenImages();

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {stage === "collecting" ? (
            <motion.div
              key="cards"
              layout
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {CARD_DEFS.map((card) => (
                <AngleUploadCard
                  key={card.key}
                  venueId={venueId}
                  cardKey={card.key}
                  label={card.label}
                  hint={card.hint}
                  kind={card.kind}
                  images={cardImages[card.key] ?? []}
                  onAdd={addImage}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div key="stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full gap-4">
              {/* Sidebar: uploaded images morph here via shared layoutId */}
              <div className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto">
                {sidebarImages.map((img) => (
                  <motion.div
                    key={img.blobUrl}
                    layoutId={img.blobUrl}
                    className="relative aspect-square w-full overflow-hidden rounded-lg border border-white/10"
                  >
                    <Image src={img.blobUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
                  </motion.div>
                ))}
              </div>

              {/* Center stage */}
              <div className="flex flex-1 items-center justify-center">
                {stage === "generating" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3 text-center"
                  >
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-loverai-gold/30 border-t-loverai-gold" />
                    <p className="text-sm text-[color:var(--text-muted)]">Generating your venue design…</p>
                  </motion.div>
                )}

                {stage === "question" && question && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card max-w-md rounded-xl p-5 text-center"
                  >
                    <p className="text-sm text-loverai-gold">{question}</p>
                    <p className="mt-2 text-xs text-[color:var(--text-muted)]">Reply below to continue.</p>
                  </motion.div>
                )}

                {stage === "done" && result && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                    className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3"
                  >
                    {result.renders.map((r, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { opacity: 0, scale: 0.94 },
                          visible: { opacity: 1, scale: 1 },
                        }}
                      >
                        {"resultBlobUrl" in r && r.resultBlobUrl ? (
                          <Image
                            src={r.resultBlobUrl}
                            alt="Generated render"
                            width={320}
                            height={220}
                            className="h-36 w-full rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-lg bg-red-950/40 p-2 text-center text-[10px] text-red-300">
                            {"error" in r ? r.error : "Failed"}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stage === "done" && result && (
        <div className="mt-3 shrink-0">
          <Link href={`/venues/${venueId}/designs`} className="text-sm text-loverai-gold hover:underline">
            Open full designs view →
          </Link>
        </div>
      )}

      {error && <p className="mt-2 shrink-0 text-sm text-red-400">{error}</p>}

      {stage !== "done" && (
        <div className="glass-input mt-4 flex shrink-0 items-center gap-2 rounded-xl px-3 py-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              stage === "collecting"
                ? 'Describe what you want, e.g. "wedding mandap, gold and white theme, 200 guests"'
                : "Type your answer…"
            }
            disabled={submitting}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-dim)]"
          />
          <button
            onClick={handleSend}
            disabled={submitting || !chatInput.trim()}
            className="rounded-lg bg-loverai-gold px-4 py-1.5 text-sm font-medium text-loverai-deep hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "…" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}
