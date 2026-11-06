"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/state/auth";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/ui/Spinner";

/** Everything under /app needs a session; without one, go to sign-in and come back. */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") return <Loading label="Signing you in" />;
  return <AppShell>{children}</AppShell>;
}
