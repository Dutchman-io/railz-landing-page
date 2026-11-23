import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

/**
 * The frame for sign-in, sign-up and password reset: the landing page's
 * promise on a brand panel beside the form on wide screens, the form alone on
 * phones.
 */
export function AuthCard({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-[44%] max-w-2xl shrink-0 flex-col justify-between overflow-hidden bg-hero p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-1/4 size-[34rem] rounded-full opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.6)_1.3px,transparent_1.4px)] [background-size:14px_14px] [mask-image:radial-gradient(circle,black_40%,transparent_70%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="relative">
          <Logo onDark />
        </div>
        <div className="relative">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Stablecoin-backed payments</p>
          <p className="mt-4 font-display text-5xl leading-[1.02] font-bold tracking-tight">
            Pay across borders.
            <br />
            <span className="text-sky-300">Settled in stablecoins.</span>
          </p>
          <p className="mt-6 max-w-md text-lg text-white/75">
            Pay bank accounts in other countries, get paid by clients abroad, and hold a dollar-pegged balance in between.
          </p>
        </div>
        <p className="relative text-sm text-white/60">Verification follows the CBN’s tiered KYC framework.</p>
      </aside>

      <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-14">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className={`mt-10 w-full lg:mt-[12vh] ${wide ? "max-w-xl" : "max-w-md"}`}>
          <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-[1.05rem] text-muted">{subtitle}</p>}
          <div className="mt-8 rounded-3xl border border-border/70 bg-surface p-6 shadow-card sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
