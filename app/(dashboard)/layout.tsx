import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getOrCreateAppUser, isOnboarded } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateAppUser();
  if (!isOnboarded(user)) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-loverai-base">
      <header className="glass-topbar sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <Link href="/venues" className="heading-font text-xl text-loverai-gold">
          VenueAI
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[color:var(--text-muted)]">{user.companyName}</span>
          <UserButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
