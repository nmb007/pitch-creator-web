"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useHydrated, useSession } from "@/shared/session/use-session";

export default function HomePage() {
  const router = useRouter();
  const session = useSession();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    router.replace(session ? "/decks" : "/login");
  }, [hydrated, router, session]);

  return <p className="p-8">Opening the app…</p>;
}
