"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounts a tiny client component that calls router.refresh() on a fixed
 * interval. Use on server-rendered pages that should reflect live database
 * changes (e.g. live match cards on the home page) without making the user
 * navigate away.
 */
export function AutoRefresher({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
