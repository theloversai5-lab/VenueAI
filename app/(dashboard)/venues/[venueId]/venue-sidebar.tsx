"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NAV_ITEMS(venueId: string) {
  return [
    { href: `/venues/${venueId}`, label: "Overview" },
    { href: `/venues/${venueId}/setup`, label: "Quick setup" },
    { href: `/venues/${venueId}/photos`, label: "Venue photos" },
    { href: `/venues/${venueId}/references`, label: "Reference images" },
    { href: `/venues/${venueId}/components`, label: "Component library" },
    { href: `/venues/${venueId}/designs`, label: "Designs" },
    { href: `/venues/${venueId}/layout`, label: "Layout" },
    { href: `/venues/${venueId}/presentation`, label: "Presentation" },
  ];
}

export function VenueSidebar({ venueId, venueName }: { venueId: string; venueName: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS(venueId);

  return (
    <nav className="glass-sidebar flex w-56 shrink-0 flex-col gap-1 rounded-xl p-3">
      <p className="truncate px-2 pb-2 text-xs uppercase tracking-wide text-[color:var(--text-dim)]">
        {venueName}
      </p>
      {items.map((item) => {
        const active = item.href === `/venues/${venueId}` ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-loverai-gold/15 text-loverai-gold"
                : "text-[color:var(--text-secondary)] hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/venues"
        className="mt-2 rounded-lg px-3 py-2 text-xs text-[color:var(--text-dim)] hover:bg-white/5"
      >
        ← All venues
      </Link>
    </nav>
  );
}
