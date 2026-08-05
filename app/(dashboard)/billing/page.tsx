import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wallets } from "@/db/schema";
import { getOrCreateAppUser } from "@/lib/auth";
import { RechargePanel } from "./recharge-panel";

export default async function BillingPage() {
  const user = await getOrCreateAppUser();
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, user.id) });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="heading-font text-3xl text-white">Billing</h1>
      <div className="glass-card mt-6 rounded-xl p-6">
        <p className="text-sm text-[color:var(--text-muted)]">Credit balance</p>
        <p className="heading-font text-4xl text-loverai-gold">{wallet?.balanceCredits ?? 0}</p>
      </div>
      <div className="mt-6">
        <RechargePanel />
      </div>
    </div>
  );
}
