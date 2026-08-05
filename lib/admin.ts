import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, wallets, apiUsageLog } from "@/db/schema";

export type AdminUserRow = {
  id: string;
  email: string;
  phoneNumber: string | null;
  companyName: string | null;
  balanceCredits: number;
  lifetimeApiCostUsd: number;
  lifetimeChargedCredits: number;
  createdAt: Date;
};

export async function getAdminUserList(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber,
      companyName: users.companyName,
      createdAt: users.createdAt,
      balanceCredits: sql<number>`coalesce(${wallets.balanceCredits}, 0)`,
      lifetimeApiCostUsd: sql<number>`coalesce((select sum(${apiUsageLog.reportedCostUsd}) from ${apiUsageLog} where ${apiUsageLog.userId} = ${users.id}), 0)`,
      lifetimeChargedCredits: sql<number>`coalesce((select sum(${apiUsageLog.chargedCredits}) from ${apiUsageLog} where ${apiUsageLog.userId} = ${users.id}), 0)`,
    })
    .from(users)
    .leftJoin(wallets, sql`${wallets.userId} = ${users.id}`)
    .orderBy(sql`${users.createdAt} desc`);

  return rows;
}

export async function getAdminStats() {
  const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)` }).from(users);
  const [{ totalApiCostUsd }] = await db
    .select({ totalApiCostUsd: sql<number>`coalesce(sum(${apiUsageLog.reportedCostUsd}), 0)` })
    .from(apiUsageLog);
  const totalApiCost = Number(totalApiCostUsd) || 0;

  return {
    totalUsers: Number(totalUsers) || 0,
    totalApiCostUsd: totalApiCost,
    totalRevenueUsd: totalApiCost * 5,
  };
}
