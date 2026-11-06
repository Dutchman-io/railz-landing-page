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
  { href: "/app/tokens", label: "Stablecoins", icon: icon("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10M9 9.5c0-1 1.3-1.8 3-1.8s3 .8 3 1.8-1.3 1.6-3 2-3 1-3 2 1.3 1.8 3 1.8 3-.8 3-1.8") },
  { href: "/app/bills", label: "Bills", icon: icon("M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6") },
  { href: "/app/history", label: "History", icon: icon("M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"), mobile: true },
  { href: "/app/bank-accounts", label: "Bank accounts", icon: icon("M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3 3 8h18l-9-5Z") },
  { href: "/app/settings", label: "Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"), mobile: true },
];

const isActive = (pathname: string, href: string) =>
  href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, stale } = useAuth();

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo href="/app" />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-wash hover:text-foreground aria-[current=page]:bg-wash aria-[current=page]:text-primary"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border px-2 pt-4">
          <p className="truncate text-sm font-semibold">
            {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : ""}
          </p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <button type="button" onClick={() => void signOut()} className="mt-3 text-sm font-medium text-danger hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo href="/app" />
          <button type="button" onClick={() => void signOut()} className="text-sm font-medium text-muted">
            Sign out
          </button>
        </header>
        {stale && (
          <div className="bg-warning/15 px-4 py-2 text-center text-sm text-warning" role="status">
            You’re offline. Showing your last known details.
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.filter((n) => n.mobile).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium text-muted aria-[current=page]:text-primary"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
