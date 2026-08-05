// Credit conversion + markup constants for VenueAI's billing model.
// TODO(confirm-with-user): these are reasonable starting defaults, not
// numbers the user has confirmed — revisit before Phase 2 starts actually
// debiting credits for real AI calls.

export const SIGNUP_BONUS_CREDITS = 20;
export const USD_PER_CREDIT = 0.05;
export const COST_MARKUP_MULTIPLIER = 5;

export function usdCostToCredits(costUsd: number): number {
  return Math.ceil((costUsd * COST_MARKUP_MULTIPLIER) / USD_PER_CREDIT);
}

export const CREDIT_PACKS = [
  { id: "starter", name: "Starter", credits: 100, priceInr: 32900 },
  { id: "growth", name: "Growth", credits: 250, priceInr: 74900 },
  { id: "studio", name: "Studio", credits: 600, priceInr: 159900 },
] as const;
