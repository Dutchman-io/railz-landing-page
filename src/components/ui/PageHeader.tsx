import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** A link back, e.g. { href: "/app/history", label: "History" }. */
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-1">
      {back && (
        <Link href={back.href} className="mb-1 inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </header>
  );
}
