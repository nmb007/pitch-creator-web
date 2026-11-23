"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { clearSession } from "@/shared/session/session-store";
import { useHydrated, useSession } from "@/shared/session/use-session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const hydrated = useHydrated();

  useEffect(() => {
    if (hydrated && !session) {
      router.replace("/login");
    }
  }, [hydrated, router, session]);

  if (!hydrated || !session) {
    return <p className="p-8">Checking your session…</p>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-stone-300 pb-4">
        <nav className="flex gap-4 text-sm">
          <Link href="/decks">Decks</Link>
          <Link href="/pitch/new">New Chat</Link>
        </nav>
        <button
          className="text-sm"
          type="button"
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
        >
          Log out {session.email}
        </button>
      </header>
      {children}
    </div>
  );
}
