"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/state/auth";
import { Logo } from "@/components/ui/Logo";

/*
 * The signed-in frame: a sidebar on wide screens, a bottom bar on phones.
 * Add a destination here and it appears in both.
 */

type NavItem = { href: string; label: string; icon: ReactNode; mobile?: boolean };

const icon = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: icon("M3 11.5 12 4l9 7.5M5 10v10h14V10"), mobile: true },
  { href: "/app/send", label: "Send", icon: icon("M5 12h14M13 6l6 6-6 6"), mobile: true },
  { href: "/app/receive", label: "Receive", icon: icon("M19 12H5M11 6l-6 6 6 6") },
  { href: "/app/convert", label: "Convert", icon: icon("M7 7h11l-3-3M17 17H6l3 3"), mobile: true },
  { href: "/app/tokens", label: "Tokens", icon: icon("M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM18.1 10.4a6 6 0 1 1-7.7 7.7M7 7h2v4") },
  { href: "/app/bills", label: "Bills", icon: icon("M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6") },
  { href: "/app/history", label: "History", icon: icon("M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"), mobile: true },
  { href: "/app/bank-accounts", label: "Bank accounts", icon: icon("M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3 3 8h18l-9-5Z") },
  { href: "/app/settings", label: "Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"), mobile: true },
];

const isActive = (pathname: string, href: string) =>
  href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

const initials = (first?: string | null, last?: string | null, email?: string | null) =>
  ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || (email?.[0] ?? "?").toUpperCase();

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, stale } = useAuth();
  const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "";

  return (
    <div className="min-h-dvh lg:flex">
      {/* The brand panel: deep navy into blue, the landing page's hero colours. */}
      <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-[#082f49] via-[#0c4a6e] to-[#0369a1] px-4 py-7 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-[#0ea5e9] opacity-40 blur-3xl"
        />
        <div className="relative px-3">
          <Logo href="/app" onDark />
        </div>
        <nav className="relative mt-10 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[0.95rem] font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-white aria-[current=page]:text-[#0284c7] aria-[current=page]:shadow-lg"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="relative flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-[#0284c7] font-display text-sm font-bold text-white">
            {initials(user?.firstName, user?.lastName, user?.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <button type="button" onClick={() => void signOut()} className="text-xs font-medium text-white/70 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-lg lg:hidden">
          <Logo href="/app" />
          <Link
            href="/app/settings"
            aria-label="Settings and account"
            className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-primary font-display text-xs font-bold text-white"
          >
            {initials(user?.firstName, user?.lastName, user?.email)}
          </Link>
        </header>
        {stale && (
          <div className="bg-warning/15 px-4 py-2 text-center text-sm text-warning" role="status">
            You’re offline. Showing your last known details.
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-12 lg:pb-12">{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-3 z-30 flex rounded-3xl border border-border/70 bg-surface/90 p-1.5 shadow-card backdrop-blur-lg pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {NAV.filter((n) => n.mobile).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.68rem] font-semibold text-muted transition-colors aria-[current=page]:bg-wash aria-[current=page]:text-primary"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
