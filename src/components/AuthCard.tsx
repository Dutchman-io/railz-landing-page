import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

/** The frame for sign-in, sign-up and password reset. */
export function AuthCard({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-wash to-background px-4 py-10">
      <Logo />
      <div className={`mt-10 w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
