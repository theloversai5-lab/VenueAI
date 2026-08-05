import { redirect } from "next/navigation";
import { getOrCreateAppUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateAppUser();
  if (!user.isAdmin) redirect("/venues");

  return (
    <div className="min-h-screen bg-loverai-base">
      <header className="glass-topbar px-6 py-4">
        <h1 className="heading-font text-xl text-loverai-gold">VenueAI Admin</h1>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
