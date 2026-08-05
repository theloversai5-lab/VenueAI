import { redirect } from "next/navigation";
import { getOrCreateAppUser, isOnboarded } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await getOrCreateAppUser();
  if (isOnboarded(user)) redirect("/venues");

  return (
    <div className="flex min-h-screen items-center justify-center bg-loverai-base px-4">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 animate-fade-in-up">
        <h1 className="heading-font text-3xl text-loverai-gold">Welcome to VenueAI</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          A couple of details before you get started.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
