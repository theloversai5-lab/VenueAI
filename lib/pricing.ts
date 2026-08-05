// Per-token USD pricing used to turn AI SDK v7's `result.usage` (token
// counts, always reported) into an estimated cost. We route Gemini/Groq
// directly rather than through the Vercel AI Gateway (see lib/ai.ts), so we
// don't get a dollar figure handed back automatically — this table is our
// own estimate.
//
// TODO(confirm-with-user): rates below are best-effort placeholders, not
// verified against Groq's/Google's current published pricing pages. Revisit
// before relying on these for real financial reporting.

type TokenPricing = { inputPerMillion: number; outputPerMillion: number };

const PRICING: Record<string, TokenPricing> = {
  "meta-llama/llama-4-scout-17b-16e-instruct": { inputPerMillion: 0.11, outputPerMillion: 0.34 },
  "gemini-2.5-flash-image": { inputPerMillion: 0.3, outputPerMillion: 30 }, // image output priced far higher than text
};

export function estimateCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * pricing.inputPerMillion;
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * pricing.outputPerMillion;
  return input + output;
}
