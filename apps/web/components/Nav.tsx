"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";

const NAV_ITEMS = [
  {
    href: "/library",
    label: "Library",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Playlists",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 10h16M4 14h10M4 18h10"
        />
      </svg>
    ),
  },
  {
    href: "/downloads",
    label: "Downloads",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
        />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (active: boolean) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <SignedIn>
      {/* ── Desktop: slim top bar ── */}
      <header className="hidden sm:flex items-center justify-between px-lg h-14 border-b border-paper-edge bg-paper sticky top-0 z-40">
        <span className="text-ink font-bold text-body-lg tracking-tight">
          Aani
        </span>

        <nav className="flex items-center gap-xs">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-base py-xs rounded-full text-caption font-semibold transition-colors ${
                  active
                    ? "bg-ink text-ink-inverse"
                    : "text-ink-muted hover:text-ink hover:bg-paper-sunken"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <UserButton afterSignOutUrl="/sign-in" />
      </header>

      {/* ── Mobile: top wordmark bar ── */}
      <header className="sm:hidden flex items-center justify-between px-base h-12 bg-paper border-b border-paper-edge">
        <span className="text-ink font-bold text-body tracking-tight">
          Aani
        </span>
        <UserButton afterSignOutUrl="/sign-in" />
      </header>

      {/* ── Mobile: bottom tab bar ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-paper-edge flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-[2px] py-sm transition-colors ${
                active ? "text-ink" : "text-ink-faint"
              }`}
            >
              {icon(active)}
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </SignedIn>
  );
}
