import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "VenueAI",
  description: "AI-generated venue decor visualizations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-loverai-base text-white">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
