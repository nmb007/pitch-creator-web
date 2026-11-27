"use client";

import { BookOpen, LogOut, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import { SidebarPitches } from "@/features/pitch/sidebar-pitches";
import { clearSession } from "@/shared/session/session-store";
import { useHydrated, useSession } from "@/shared/session/use-session";

const NAV = [
  { href: "/decks", label: "Case studies", icon: BookOpen },
  { href: "/pitch/new", label: "New Chat", icon: MessageSquarePlus },
] as const;

function emailInitial(email: string) {
  return (email.trim().charAt(0) || "?").toUpperCase();
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_70%,var(--line))] px-3 py-6">
        <Link href="/decks" className="mb-5 flex items-center gap-2.5 px-2 no-underline">
          <img
            src="/logo.png?v=2"
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0"
          />
          <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">Pitch Creator</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] font-medium text-[var(--ink)]"
                    : "text-stone-600 hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-[var(--line)] pt-3">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Chats
          </p>
          <Suspense fallback={<p className="px-3 py-2 text-xs text-stone-500">Loading chats…</p>}>
            <SidebarPitches />
          </Suspense>
        </div>

        <div className="mt-auto border-t border-[var(--line)] pt-4">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-1.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white"
            >
              {emailInitial(session.email)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Signed in
              </p>
              <p className="truncate text-sm text-[var(--ink)]" title={session.email}>
                {session.email}
              </p>
            </div>
          </div>
          <button
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-sm font-medium text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--accent)] hover:bg-white hover:text-[var(--accent)]"
            type="button"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            Log out
          </button>
        </div>
      </aside>

      <div className="mx-auto min-h-screen w-full max-w-3xl px-6 py-8">
        {children}
      </div>
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
