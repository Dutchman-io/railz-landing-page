"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Mobile's router.back(). A tab opened straight on the page has nothing to go
 * back to, so it lands on Settings, where verification is reached from.
 */
export function useGoBack() {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/app/settings");
  }, [router]);
}
