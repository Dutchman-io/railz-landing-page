import Link from "next/link";

export function Logo({ href = "/", onDark = false }: { href?: string; onDark?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="ZemFi home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-xl shadow-md ring-1 ring-black/5" />
      <span className={`font-display text-[1.35rem] font-bold tracking-tight ${onDark ? "text-white" : ""}`}>
        Zem<span className={onDark ? "text-sky-300" : "text-primary"}>Fi</span>
      </span>
    </Link>
  );
}
