// Stub for Phase 2. AI calls will go through Vercel AI SDK v7 (see the `ai`
// package, already installed) via the AI Gateway, using GEMINI_API_KEY /
// GROQ_API_KEY as the underlying provider credentials. Each call's
// usage/cost metadata feeds `api_usage_log.reportedCostUsd` — see
// lib/billing.ts for the 5x markup conversion.
//
// Intentionally empty until Phase 2 confirms the exact AI SDK v7 provider
// string / usage-metadata shape (see the vercel:ai-sdk skill).
export {};
