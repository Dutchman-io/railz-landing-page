import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="ZemFi home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className="font-display text-xl font-bold tracking-tight">
        Zem<span className="text-primary">Fi</span>
      </span>
    </Link>
  );
}
