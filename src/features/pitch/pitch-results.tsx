"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowUpToLine, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { seedTurnMessages, type TurnPendingIds } from "@/features/pitch/apply-sse-turn";
import type { ChatMessage, MatchItem } from "@/features/pitch/chat-types";
import {
  isToolCallBody,
  isToolResultBody,
  splitAssistantBody,
  toolCallNameFromBody,
  ToolCallBlock,
  ToolResultBlock,
} from "@/features/pitch/chat-tool-block";
import { handleLiveSseEvent } from "@/features/pitch/handle-live-sse";
import {
  attachCreateStream,
  clearCreateStream,
  getCreateStreamSeed,
  isCreateStreamActive,
} from "@/features/pitch/pitch-stream-session";
import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import {
  postPitchMessageStream,
  putPitchSelectionStream,
  readPitchSse,
} from "@/shared/api/sse";
import { MarkdownBody } from "@/shared/ui/markdown-body";

function StudyMatchCard({
  match,
  selectable,
  checked,
  onToggle,
}: {
  match: MatchItem;
  selectable: boolean;
  checked: boolean;
  onToggle: (studyId: string, next: boolean) => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  return (
    <li
      className={
        selectable && checked
          ? "rounded-xl border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,white)] p-4"
          : "rounded-xl border border-stone-300 bg-white p-4"
      }
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <label className="mt-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={checked}
              onChange={(event) => onToggle(match.study_id, event.target.checked)}
              aria-label={`Select ${match.title}`}
            />
          </label>
        ) : (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-200/80 text-xs font-medium text-stone-600">
            {match.rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-stone-500">{match.section}</p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug text-stone-800">
            {match.title}
          </h3>
        </div>
      </div>
      {match.reason ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
            Why it fits
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stone-800">{match.reason}</p>
        </div>
      ) : null}
      {match.source_quote ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-stone-600 transition-colors hover:bg-stone-100"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen((open) => !open)}
          >
            <BookOpen className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 text-[13px] font-medium">Source</span>
            <ChevronRight
              className={`size-4 shrink-0 text-stone-400 transition-transform ${
                sourceOpen ? "rotate-90" : ""
              }`}
              strokeWidth={1.75}
            />
          </button>
          {sourceOpen ? (
            <div className="border-t border-stone-200 px-3 py-3">
              <blockquote className="border-l-2 border-stone-300 pl-3 text-sm leading-relaxed whitespace-pre-wrap text-stone-600">
                {match.source_quote}
              </blockquote>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

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

/** Keep the pitch-ready reply (and its live pending bubble) below Suggested studies. */
function splitAroundPitchReply(
  messages: ChatMessage[],
  generateAssistantId: string | null,
): { before: ChatMessage[]; after: ChatMessage[] } {
  const byLink = messages.findIndex(
    (message) => message.role === "assistant" && message.body.includes("/pitch/view?"),
  );
  const byId =
    generateAssistantId == null
      ? -1
      : messages.findIndex((message) => message.id === generateAssistantId);
  const splitAt = byLink >= 0 ? byLink : byId;
  if (splitAt < 0) {
    return { before: messages, after: [] };
  }
  return {
    before: messages.slice(0, splitAt),
    after: messages.slice(splitAt),
  };
}

export function PitchResults() {
  const params = useSearchParams();
  const pitchId = params.get("id");
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedStudyIds, setSelectedStudyIds] = useState<string[]>([]);
  const [hasPage, setHasPage] = useState(false);
  const [generateAssistantId, setGenerateAssistantId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnStatus, setTurnStatus] = useState<string | null>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
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
    setSelectedStudyIds([]);
    setHasPage(false);
    setGenerateAssistantId(null);
    setDraft("");
    setError(null);
    setBusy(false);
    setTurnStatus(null);
    setRunningTool(null);
    liveTurnRef.current = false;
    turnIdsRef.current = null;
  }, [pitchId]);

  useEffect(() => {
    if (!pitch.data) {
      return;
    }
    setHasPage(Boolean(pitch.data.has_page));
  }, [pitch.data]);

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
    setTurnStatus(null);
    setRunningTool(null);

    const detach = attachCreateStream(
      pitchId,
      (packet) => {
        const ids = turnIdsRef.current;
        if (!ids) {
          return;
        }
        try {
          handleLiveSseEvent(packet.event, packet.data, {
            ids,
            setMessages,
            setMatches,
            setTurnStatus,
            setRunningTool,
            onMatches: (items) => {
              queryClient.setQueryData(["matches", pitchId], items);
              queryClient.setQueryData(["pitch", pitchId], (current: typeof pitch.data) =>
                current ? { ...current, has_matches: items.length > 0 } : current,
              );
            },
          });
        } catch (caught) {
          setError(
            caught instanceof Error ? caught.message : "The turn failed.",
          );
          liveTurnRef.current = false;
          setBusy(false);
          setTurnStatus(null);
          setRunningTool(null);
        }
      },
      () => {
        liveTurnRef.current = false;
        setBusy(false);
        setTurnStatus(null);
        setRunningTool(null);
        clearCreateStream(pitchId);
        void queryClient.invalidateQueries({ queryKey: ["pitch-page", pitchId] });
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
  }, [messages, matches, busy, turnStatus]);

  useEffect(() => {
    const node = transcriptRef.current;
    const onScroll = () => {
      const windowDown = window.scrollY > 240;
      const transcriptDown = (node?.scrollTop ?? 0) > 240;
      setShowBackToTop(windowDown || transcriptDown);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    node?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      node?.removeEventListener("scroll", onScroll);
    };
  }, [pitchId, messages.length, matches.length]);

  function scrollToTop() {
    transcriptRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleStudy(studyId: string, next: boolean) {
    setSelectedStudyIds((current) => {
      if (next) {
        return current.includes(studyId) ? current : [...current, studyId];
      }
      return current.filter((id) => id !== studyId);
    });
  }

  async function generatePitch() {
    if (!pitchId || selectedStudyIds.length === 0 || busy || hasPage) {
      return;
    }
    setError(null);
    setBusy(true);
    liveTurnRef.current = true;
    setTurnStatus(null);
    setRunningTool(null);
    const seeded = seedTurnMessages("");
    turnIdsRef.current = seeded.ids;
    setGenerateAssistantId(seeded.ids.assistantId);
    const pendingAssistant: ChatMessage = {
      id: seeded.ids.assistantId,
      role: "assistant",
      body: "",
      pending: true,
    };
    setMessages((current) => [...current, pendingAssistant]);
    try {
      const response = await putPitchSelectionStream(pitchId, selectedStudyIds);
      let wrotePage = false;
      await readPitchSse(response, (eventName, data) => {
        const ids = turnIdsRef.current;
        if (!ids) {
          return;
        }
        if (eventName === "assistant.message") {
          wrotePage = true;
          if (typeof data.id === "string" && data.id) {
            setGenerateAssistantId(data.id);
          }
        }
        handleLiveSseEvent(eventName, data, {
          ids,
          setMessages,
          setMatches,
          setTurnStatus,
          setRunningTool,
        });
      });
      if (wrotePage) {
        setHasPage(true);
        queryClient.setQueryData(["pitch", pitchId], (current: typeof pitch.data) =>
          current ? { ...current, has_page: true } : current,
        );
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The pitch could not be generated.",
      );
      const ids = turnIdsRef.current;
      if (ids) {
        setMessages((current) => current.filter((row) => row.id !== ids.assistantId));
      }
      setGenerateAssistantId(null);
    } finally {
      liveTurnRef.current = false;
      setBusy(false);
      setTurnStatus(null);
      setRunningTool(null);
      turnIdsRef.current = null;
    }
  }

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
    setTurnStatus(null);
    setRunningTool(null);
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
        handleLiveSseEvent(eventName, data, {
          ids,
          setMessages,
          setMatches,
          setTurnStatus,
          setRunningTool,
          onMatches: (items) => {
            queryClient.setQueryData(["matches", pitchId], items);
            queryClient.setQueryData(["pitch", pitchId], (current: typeof pitch.data) =>
              current ? { ...current, has_matches: items.length > 0 } : current,
            );
          },
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
      setTurnStatus(null);
      setRunningTool(null);
      turnIdsRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["pitch-page", pitchId] });
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

  const { before: messagesBeforeStudies, after: messagesAfterStudies } = splitAroundPitchReply(
    messages,
    generateAssistantId,
  );
  const statusAfterStudies = Boolean(generateAssistantId) || hasPage;

  function renderMessage(message: ChatMessage) {
    // Use the full transcript so a day label is not repeated when the list is
    // split around Suggested studies.
    const fullIndex = messages.findIndex((row) => row.id === message.id);
    const prev = fullIndex > 0 ? messages[fullIndex - 1] : undefined;
    const showDay =
      Boolean(message.created_at) &&
      (!prev?.created_at || dayKey(prev.created_at) !== dayKey(message.created_at!));
    const isUser = message.role === "user";
    const asToolResult =
      !isUser && Boolean(message.body) && isToolResultBody(message.body, message.role);
    const assistantParts =
      !isUser && !asToolResult && message.body ? splitAssistantBody(message.body) : null;
    const asToolCall =
      Boolean(assistantParts?.toolCallJson) ||
      (!isUser && Boolean(message.body) && isToolCallBody(message.body));
    const toolCallBody = assistantParts?.toolCallJson ?? message.body;
    const prose = assistantParts?.prose ?? "";
    const pendingLabel =
      message.id === generateAssistantId && turnStatus
        ? turnStatus
        : "Hang tight, we're working on it!";

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
            <ToolCallBlock
              body={toolCallBody}
              running={
                Boolean(runningTool) && toolCallNameFromBody(toolCallBody) === runningTool
              }
            />
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
            ) : message.pending ? (
              <p className="flex items-center gap-2 text-stone-600">
                <Loader2
                  className="size-3.5 shrink-0 animate-spin"
                  strokeWidth={2}
                  aria-hidden
                />
                <span>{pendingLabel}</span>
              </p>
            ) : null}
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
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 border-b border-stone-300 pb-3">
        <h1 className="text-xl font-semibold text-stone-800">
          {pitch.data?.title || getCreateStreamSeed(pitchId)?.userText || "Pitch chat"}
        </h1>
      </header>

      <div ref={transcriptRef} className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
        {messagesBeforeStudies.map((message) => renderMessage(message))}

        {!statusAfterStudies && turnStatus ? (
          <div className="mr-auto max-w-[85%]">
            <p className="inline-flex items-center gap-2 rounded-full bg-stone-200/70 px-3 py-1.5 text-[13px] text-stone-600">
              <Loader2 className="size-3 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
              <span>{turnStatus}</span>
            </p>
          </div>
        ) : null}

        {matches.length > 0 ? (
          <section className="mt-2">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-sm font-medium text-stone-600">Suggested studies</h2>
              {!hasPage ? (
                <p className="text-xs text-stone-500">
                  Select the ones to include, then generate a pitch.
                </p>
              ) : null}
            </div>
            <ul className="flex flex-col gap-3">
              {matches.map((match) => (
                <StudyMatchCard
                  key={`${match.study_id}-${match.rank}`}
                  match={match}
                  selectable={!hasPage}
                  checked={selectedStudyIds.includes(match.study_id)}
                  onToggle={toggleStudy}
                />
              ))}
            </ul>
            {!hasPage ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={busy || selectedStudyIds.length === 0}
                  onClick={() => void generatePitch()}
                >
                  Generate pitch
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {messagesAfterStudies.map((message) => renderMessage(message))}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 z-10 mt-auto border-t border-stone-300 bg-[var(--paper)] pt-3">
        {showBackToTop ? (
          <button
            type="button"
            className="group absolute -top-11 -right-10 flex size-8 cursor-pointer items-center justify-center rounded-full border border-stone-300 bg-white text-stone-600 shadow-sm transition-colors hover:text-stone-900"
            aria-label="Back to top"
            title="Back to top"
            onClick={scrollToTop}
          >
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 rounded-md bg-stone-800 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white group-hover:block">
              Back to top
            </span>
            <ArrowUpToLine className="size-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
        <form onSubmit={sendFollowUp}>
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
      </div>
    </main>
  );
}
