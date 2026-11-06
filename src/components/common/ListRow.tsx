import Link from "next/link";
import { Children } from "react";
import type { ReactNode } from "react";

/**
 * One line of a list: something on the left, a title and a quiet second line,
 * and a value on the right with its own second line. A link when given `href`,
 * a button when given `onClick`, with a chevron to say so.
 */
export function ListRow({
  left,
  title,
  subtitle,
  value,
  subvalue,
  href,
  onClick,
}: {
  left?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  subvalue?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {left}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {(value || subvalue) && (
        <div className="shrink-0 text-right">
          {value && <p className="font-semibold tabular">{value}</p>}
          {subvalue && <p className="text-sm text-muted">{subvalue}</p>}
        </div>
      )}
      {(href || onClick) && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-subtle" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3.5 text-left";
  if (href)
    return (
      <Link href={href} className={`${cls} transition-colors hover:bg-wash`}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-wash`}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/** Rows grouped on one card, divided by hairlines. */
export function ListGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{rows}</div>;
}

/** A quiet heading above a group, with an optional action on the right. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-8 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {action}
    </div>
  );
}
