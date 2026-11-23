"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { apiClient } from "@/shared/api/client";

export function SidebarPitches() {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("id");

  const pitches = useQuery({
    queryKey: ["pitches"],
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches");
      return data ?? [];
    },
  });

  if (pitches.isLoading) {
    return (
      <p className="px-3 py-2 text-xs text-stone-500">Loading chats…</p>
    );
  }

  if (!pitches.data?.length) {
    return null;
  }

  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {pitches.data.map((pitch) => {
        const href = `/pitch?id=${pitch.id}`;
        const active = activeId === pitch.id;
        const label = pitch.title.trim() || "Untitled chat";
        return (
          <li key={pitch.id}>
            <Link
              href={href}
              title={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
                active
                  ? "bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] font-medium text-[var(--ink)]"
                  : "text-stone-600 hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-[var(--ink)]"
              }`}
            >
              <MessageSquare className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
