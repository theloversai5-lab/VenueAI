import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, wallets, creditTransactions } from "@/db/schema";
import { SIGNUP_BONUS_CREDITS } from "@/lib/billing";

export type AppUser = typeof users.$inferSelect;

// Lazily syncs the Clerk-authenticated caller into our own `users` table
// (keyed by Clerk's userId) and grants the signup bonus exactly once, the
// first time we see a given Clerk user. Call this from any server
// component/route that needs the app-level user row.
export async function getOrCreateAppUser(): Promise<AppUser> {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("getOrCreateAppUser called without an authenticated Clerk session");
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, clerkUser.id),
  });
  if (existing) return existing;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const [created] = await db
    .insert(users)
    .values({
      id: clerkUser.id,
      email,
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
    })
    .onConflictDoNothing()
    .returning();

  const user = created ?? (await db.query.users.findFirst({ where: eq(users.id, clerkUser.id) }))!;

  // Grant the wallet + signup bonus once, tied to this user existing.
  const existingWallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, user.id) });
  if (!existingWallet) {
    await db.insert(wallets).values({
      userId: user.id,
      balanceCredits: SIGNUP_BONUS_CREDITS,
      lifetimeAddedCredits: SIGNUP_BONUS_CREDITS,
    });
    await db.insert(creditTransactions).values({
      userId: user.id,
      type: "signup_bonus",
      credits: SIGNUP_BONUS_CREDITS,
      reason: "Free signup credits",
    });
  }

  return user;
}

export function isOnboarded(user: AppUser): boolean {
  return Boolean(user.phoneNumber && user.companyName);
}
