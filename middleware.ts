import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

// Only session presence is checked here. Onboarding completeness (phone/
// company) and the isAdmin flag both live in our own Postgres `users` table,
// not Clerk session claims — middleware can't cheaply query Postgres per
// request, so those checks happen server-side in the relevant layouts
// (app/(dashboard)/layout.tsx, app/(admin)/layout.tsx).
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
