"use client";

import { ArrowUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { postPitchMessageStream, readPitchSse } from "@/shared/api/sse";
import { MarkdownBody } from "@/shared/ui/markdown-body";

type ChatMessage = {
  id: string;
  role: string;
  body: string;
  created_at?: string;
  pending?: boolean;
};

type MatchItem = {
  rank: number;
  reason: string;
  source_quote: string;
  section: string;
  title: string;
  study_id: string;
  selected: boolean;
};

export function PitchResults() {
  const params = useSearchParams();
  const pitchId = params.get("id");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  const pitch = useQuery({
    queryKey: ["pitch", pitchId],
    enabled: Boolean(pitchId),
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      if (!data) {
        throw new Error("Pitch was empty.");
      }
      return data;
    },
  });

  const history = useQuery({
    queryKey: ["messages", pitchId],
    enabled: Boolean(pitchId),
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/messages", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      return data ?? [];
    },
  });

  const matchQuery = useQuery({
    queryKey: ["matches", pitchId],
    enabled: Boolean(pitchId),
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/matches", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!history.data || hydrated.current) {
      return;
    }
    setMessages(
      history.data.map((row) => ({
        id: row.id,
        role: row.role,
        body: row.body,
        created_at: row.created_at,
      })),
    );
    hydrated.current = true;
  }, [history.data]);

  useEffect(() => {
    if (matchQuery.data) {
      setMatches(matchQuery.data);
    }
  }, [matchQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, matches, busy]);

  async function sendFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!pitchId || !draft.trim() || busy) {
      return;
    }
    const text = draft.trim();
    setDraft("");
    setError(null);
    setBusy(true);
    const pendingUser: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      body: text,
    };
    const pendingAssistant: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      body: "",
      pending: true,
    };
    setMessages((current) => [...current, pendingUser, pendingAssistant]);
    try {
      const response = await postPitchMessageStream(pitchId, text);
      await readPitchSse(response, (eventName, data) => {
        if (eventName === "message.user" && typeof data.body === "string") {
          setMessages((current) =>
            current.map((row) => {
              if (row.id !== pendingUser.id) {
                return row;
              }
              const next: ChatMessage = {
                id: String(data.id ?? row.id),
                role: "user",
                body: String(data.body),
              };
              if (data.created_at) {
                next.created_at = String(data.created_at);
              }
              return next;
            }),
          );
        }
        if (eventName === "assistant.delta" && typeof data.text === "string") {
          setMessages((current) =>
            current.map((row) =>
              row.id === pendingAssistant.id
                ? { ...row, body: `${row.body}${data.text}` }
                : row,
            ),
          );
        }
        if (eventName === "assistant.message" && typeof data.body === "string") {
          setMessages((current) =>
            current.map((row) => {
              if (row.id !== pendingAssistant.id) {
                return row;
              }
              const next: ChatMessage = {
                id: String(data.id ?? row.id),
                role: "assistant",
                body: String(data.body),
              };
              if (data.created_at) {
                next.created_at = String(data.created_at);
              }
              return next;
            }),
          );
        }
        if (eventName === "matches" && Array.isArray(data.items)) {
          setMatches(data.items as MatchItem[]);
        }
        if (eventName === "error") {
          throw new Error(String(data.detail ?? "The turn failed."));
        }
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The message could not be sent.",
      );
      setMessages((current) =>
        current.filter((row) => row.id !== pendingUser.id && row.id !== pendingAssistant.id),
      );
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  if (!pitchId) {
    return <p>This page needs a pitch id.</p>;
  }
  if (pitch.isPending || history.isPending) {
    return <p>Loading the conversation…</p>;
  }
  if (pitch.isError) {
    return <p className="text-red-700">The pitch could not be loaded.</p>;
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 border-b border-stone-300 pb-3">
        <h1 className="text-xl font-semibold text-stone-800">{pitch.data.title || "Pitch chat"}</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
                : "mr-auto max-w-[85%] rounded-2xl bg-stone-200/60 px-4 py-3 text-sm"
            }
          >
            {message.body ? (
              <MarkdownBody content={message.body} />
            ) : (
              <p className="text-stone-800">{message.pending ? "…" : ""}</p>
            )}
          </div>
        ))}

        {matches.length > 0 ? (
          <section className="mt-2">
            <h2 className="mb-2 text-sm font-medium text-stone-600">Suggested studies</h2>
            <ul className="flex flex-col gap-3">
              {matches.map((match) => (
                <li
                  key={`${match.study_id}-${match.rank}`}
                  className="rounded-xl border border-stone-300 bg-white p-4"
                >
                  <p className="text-sm text-stone-500">
                    {match.rank}. {match.section}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{match.title}</h3>
                  <p className="mt-2 text-sm">{match.reason}</p>
                  {match.source_quote ? (
                    <blockquote className="mt-3 border-l-2 border-stone-300 pl-3 text-sm text-stone-600">
                      {match.source_quote}
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="sticky bottom-0 mt-auto border-t border-stone-300 bg-[var(--paper)] pt-3" onSubmit={sendFollowUp}>
        <div className="flex items-end gap-2 rounded-[1.5rem] border border-stone-300 bg-white px-3 py-2">
          <textarea
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none"
            rows={1}
            placeholder="Continue the conversation…"
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="submit"
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"
            disabled={busy || !draft.trim()}
            aria-label="Send"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </form>
    </main>
  );
}
