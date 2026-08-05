import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Direct provider packages, not the Vercel AI Gateway: the Gateway needs its
// own AI_GATEWAY_API_KEY (a separate credential we don't have), whereas
// these keys are the raw Gemini/Groq keys reused from the sibling Planner
// repo. Cost is therefore derived from `result.usage` (token counts, which
// the SDK always reports) times a price-per-token table in lib/pricing.ts,
// rather than a dollar figure the Gateway would otherwise hand back directly.

export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.NANNO_BANANA,
});

export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
