"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";

export default function Nav() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname.startsWith(href)
        ? "text-white"
        : "text-zinc-400 hover:text-white"
    }`;

  return (
    <nav className="border-b border-zinc-800 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white tracking-tight">Metropol</span>
          <SignedIn>
            <Link href="/downloads" className={linkClass("/downloads")}>
              Downloads
            </Link>
            <Link href="/library" className={linkClass("/library")}>
              Library
            </Link>
          </SignedIn>
        </div>
        <div>
          <SignedIn>
            <UserButton afterSignOutUrl="/sign-in" />
          </SignedIn>
          <SignedOut>
            <SignInButton>
              <button className="text-sm text-zinc-400 hover:text-white transition-colors">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
