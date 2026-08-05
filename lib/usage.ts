import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { wallets, creditTransactions, apiUsageLog } from "@/db/schema";
import { estimateCostUsd } from "@/lib/pricing";
import { usdCostToCredits } from "@/lib/billing";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
  }
}

// Coarse pre-check only (real cost isn't known until after the call
// completes, since it depends on actual token usage) — blocks obviously
// empty wallets before spending real API cost, but a wallet can still dip
// slightly negative if a call costs more than the remaining balance.
export async function assertHasCredits(userId: string) {
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, userId) });
  if (!wallet || wallet.balanceCredits <= 0) {
    throw new InsufficientCreditsError();
  }
}

export async function logUsageAndCharge(params: {
  userId: string;
  provider: "groq" | "gemini";
  model: string;
  operation: string;
  usage: { inputTokens?: number; outputTokens?: number };
  metadata?: Record<string, unknown>;
}): Promise<{ costUsd: number; chargedCredits: number }> {
  const costUsd = estimateCostUsd(params.model, params.usage);
  const chargedCredits = usdCostToCredits(costUsd);

  await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(apiUsageLog)
      .values({
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        reportedCostUsd: costUsd.toString(),
        chargedCredits,
        metadata: params.metadata,
      })
      .returning();

    await tx
      .update(wallets)
      .set({
        balanceCredits: sql`${wallets.balanceCredits} - ${chargedCredits}`,
        lifetimeUsedCredits: sql`${wallets.lifetimeUsedCredits} + ${chargedCredits}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, params.userId));

    await tx.insert(creditTransactions).values({
      userId: params.userId,
      type: "usage",
      credits: -chargedCredits,
      reason: `${params.provider}/${params.model} ${params.operation}`,
      relatedUsageLogId: log.id,
    });
  });

  return { costUsd, chargedCredits };
}
