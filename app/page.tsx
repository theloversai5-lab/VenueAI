import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/venues");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-loverai-base px-4 text-center">
      <h1 className="heading-font animate-fade-in-up text-5xl text-loverai-gold">VenueAI</h1>
      <p className="mt-4 max-w-md text-[color:var(--text-secondary)]">
        Upload your venue and inspiration photos — VenueAI turns them into decorated,
        photorealistic renders.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-loverai-gold px-6 py-2.5 font-medium text-loverai-deep hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="glass-input rounded-lg px-6 py-2.5 font-medium hover:border-white/30"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
