"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  applyPitchSseEvent,
  seedTurnMessages,
  type TurnPendingIds,
} from "@/features/pitch/apply-sse-turn";
import type { ChatMessage, MatchItem } from "@/features/pitch/chat-types";
import {
  isToolCallBody,
  isToolResultBody,
  splitAssistantBody,
  ToolCallBlock,
  ToolResultBlock,
} from "@/features/pitch/chat-tool-block";
import {
  attachCreateStream,
  clearCreateStream,
  getCreateStreamSeed,
  isCreateStreamActive,
} from "@/features/pitch/pitch-stream-session";
import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { postPitchMessageStream, readPitchSse } from "@/shared/api/sse";
import { MarkdownBody } from "@/shared/ui/markdown-body";

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameCalendarDay(date, today)) {
    return "Today";
  }
  if (sameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PitchResults() {
  const params = useSearchParams();
  const pitchId = params.get("id");
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const liveTurnRef = useRef(false);
  const turnIdsRef = useRef<TurnPendingIds | null>(null);
  const creating = Boolean(pitchId && isCreateStreamActive(pitchId));

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
    enabled: Boolean(pitchId) && !creating,
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/messages", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      return data ?? [];
    },
  });

  // Only fetch matches when GET pitch says this thread already has shortlist rows.
  const matchQuery = useQuery({
    queryKey: ["matches", pitchId],
    enabled: Boolean(pitchId) && Boolean(pitch.data?.has_matches) && !creating,
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/matches", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (busy || !pitchId || pitch.isError) {
      return;
    }
    if (!creating && (pitch.isPending || history.isPending)) {
      return;
    }
    composerRef.current?.focus();
  }, [
    busy,
    pitchId,
    creating,
    pitch.isPending,
    pitch.isError,
    history.isPending,
  ]);

  useEffect(() => {
    setMessages([]);
    setMatches([]);
    setDraft("");
    setError(null);
    setBusy(false);
    liveTurnRef.current = false;
    turnIdsRef.current = null;
  }, [pitchId]);

  useEffect(() => {
    if (!pitchId) {
      return;
    }

    const seed = getCreateStreamSeed(pitchId);
    if (!seed && !isCreateStreamActive(pitchId)) {
      return;
    }

    const seeded = seedTurnMessages(seed?.userText || "…");
    turnIdsRef.current = seeded.ids;
    setMessages(seeded.messages);
    setBusy(true);
    liveTurnRef.current = true;
    setError(null);

    const detach = attachCreateStream(
      pitchId,
      (packet) => {
        const ids = turnIdsRef.current;
        if (!ids) {
          return;
        }
        if (packet.event === "error") {
          setError(String(packet.data.detail ?? "The turn failed."));
          liveTurnRef.current = false;
          setBusy(false);
          return;
        }
        if (packet.event === "matches" && Array.isArray(packet.data.items)) {
          const items = packet.data.items as MatchItem[];
          setMatches(items);
          queryClient.setQueryData(["matches", pitchId], items);
          queryClient.setQueryData(["pitch", pitchId], (current: typeof pitch.data) =>
            current ? { ...current, has_matches: items.length > 0 } : current,
          );
          return;
        }
        setMessages((current) => {
          const next = applyPitchSseEvent(current, packet.event, packet.data, ids);
          return next.kind === "messages" ? next.messages : current;
        });
      },
      () => {
        liveTurnRef.current = false;
        setBusy(false);
        clearCreateStream(pitchId);
        void queryClient.invalidateQueries({ queryKey: ["pitches"] });
        void queryClient.invalidateQueries({ queryKey: ["messages", pitchId] });
        void queryClient.invalidateQueries({ queryKey: ["pitch", pitchId] });
      },
    );

    if (!detach) {
      liveTurnRef.current = false;
      setBusy(false);
      return;
    }

    return detach;
  }, [pitchId, queryClient]);

  useEffect(() => {
    // Only hydrate from GET when history payload changes (load / pitch switch).
    // Do not re-run when a live turn ends (busy→false), or stale cache wipes SSE.
    if (!history.data || liveTurnRef.current) {
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
  }, [history.data, pitchId]);

  useEffect(() => {
    if (!matchQuery.data || liveTurnRef.current) {
      return;
    }
    setMatches(matchQuery.data);
  }, [matchQuery.data, pitchId]);

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
    liveTurnRef.current = true;
    const seeded = seedTurnMessages(text);
    turnIdsRef.current = seeded.ids;
    setMessages((current) => [...current, ...seeded.messages]);
    try {
      const response = await postPitchMessageStream(pitchId, text);
      await readPitchSse(response, (eventName, data) => {
        const ids = turnIdsRef.current;
        if (!ids) {
          return;
        }
        if (eventName === "error") {
          throw new Error(String(data.detail ?? "The turn failed."));
        }
        if (eventName === "matches" && Array.isArray(data.items)) {
          const items = data.items as MatchItem[];
          setMatches(items);
          queryClient.setQueryData(["matches", pitchId], items);
          queryClient.setQueryData(["pitch", pitchId], (current: typeof pitch.data) =>
            current ? { ...current, has_matches: items.length > 0 } : current,
          );
          return;
        }
        setMessages((current) => {
          const result = applyPitchSseEvent(current, eventName, data, ids);
          return result.kind === "messages" ? result.messages : current;
        });
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The message could not be sent.",
      );
      const ids = turnIdsRef.current;
      if (ids) {
        setMessages((current) =>
          current.filter((row) => row.id !== ids.userId && row.id !== ids.assistantId),
        );
      }
    } finally {
      liveTurnRef.current = false;
      setBusy(false);
      turnIdsRef.current = null;
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
  if (!creating && (pitch.isPending || history.isPending)) {
    return <p>Loading the conversation…</p>;
  }
  if (pitch.isError) {
    return <p className="text-red-700">The pitch could not be loaded.</p>;
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 border-b border-stone-300 pb-3">
        <h1 className="text-xl font-semibold text-stone-800">
          {pitch.data?.title || getCreateStreamSeed(pitchId)?.userText || "Pitch chat"}
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const showDay =
            Boolean(message.created_at) &&
            (!prev?.created_at || dayKey(prev.created_at) !== dayKey(message.created_at!));
          const isUser = message.role === "user";
          const asToolResult =
            !isUser &&
            Boolean(message.body) &&
            isToolResultBody(message.body, message.role);
          const assistantParts =
            !isUser && !asToolResult && message.body
              ? splitAssistantBody(message.body)
              : null;
          const asToolCall =
            Boolean(assistantParts?.toolCallJson) ||
            (!isUser && Boolean(message.body) && isToolCallBody(message.body));
          const toolCallBody = assistantParts?.toolCallJson ?? message.body;
          const prose = assistantParts?.prose ?? "";

          return (
            <div key={message.id} className="flex flex-col gap-4">
              {showDay && message.created_at ? (
                <div className="flex justify-center">
                  <span className="rounded-full bg-stone-200/80 px-3 py-1 text-[11px] font-medium text-stone-600">
                    {formatDayLabel(message.created_at)}
                  </span>
                </div>
              ) : null}

              {asToolResult ? (
                <div className="flex flex-col gap-1">
                  <ToolResultBlock body={message.body} />
                  {message.created_at ? (
                    <p className="pl-1 text-[11px] leading-none text-stone-500">
                      {formatMessageTime(message.created_at)}
                    </p>
                  ) : null}
                </div>
              ) : asToolCall ? (
                <div className="flex flex-col gap-2">
                  {prose ? (
                    <div className="mr-auto max-w-[85%] rounded-2xl bg-stone-200/60 px-4 py-3 text-sm">
                      <MarkdownBody content={prose} />
                    </div>
                  ) : null}
                  <ToolCallBlock body={toolCallBody} />
                  {message.created_at ? (
                    <p className="pl-1 text-[11px] leading-none text-stone-500">
                      {formatMessageTime(message.created_at)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div
                  className={
                    isUser
                      ? "ml-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
                      : "mr-auto max-w-[85%] rounded-2xl bg-stone-200/60 px-4 py-3 text-sm"
                  }
                >
                  {message.body ? (
                    <MarkdownBody content={message.body} />
                  ) : (
                    <p className="text-stone-800">{message.pending ? "…" : ""}</p>
                  )}
                  {message.created_at ? (
                    <p
                      className={`mt-1.5 text-[11px] leading-none ${
                        isUser ? "text-right text-stone-400" : "text-stone-500"
                      }`}
                    >
                      {formatMessageTime(message.created_at)}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

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

      <form
        className="sticky bottom-0 mt-auto border-t border-stone-300 bg-[var(--paper)] pt-3"
        onSubmit={sendFollowUp}
      >
        <div className="flex items-end gap-2 rounded-[1.5rem] border border-stone-300 bg-white px-3 py-2">
          <textarea
            ref={composerRef}
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
