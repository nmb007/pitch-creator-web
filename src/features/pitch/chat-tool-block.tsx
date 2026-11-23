"use client";

import { ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isToolCallBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }
  const parsed = tryParseJson(trimmed);
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as { tool_calls?: unknown }).tool_calls),
  );
}

export function isToolResultBody(body: string, role?: string): boolean {
  if (role === "tool") {
    return true;
  }
  const trimmed = body.trim();
  const match = /^([a-zA-Z0-9_]+):\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/.exec(trimmed);
  return Boolean(match);
}

/** Split assistant bodies that mix prose + tool_calls JSON. */
export function splitAssistantBody(body: string): {
  prose: string;
  toolCallJson: string | null;
} {
  const marker = '\n{"tool_calls"';
  const idx = body.indexOf(marker);
  if (idx >= 0) {
    return {
      prose: body.slice(0, idx).trim(),
      toolCallJson: body.slice(idx + 1).trim(),
    };
  }
  if (isToolCallBody(body)) {
    return { prose: "", toolCallJson: body.trim() };
  }
  return { prose: body, toolCallJson: null };
}

function ToolDetailsShell({
  title,
  subtitle,
  details,
}: {
  title: string;
  subtitle?: string;
  details: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mr-auto max-w-[85%] overflow-hidden rounded-xl border border-stone-300/80 bg-stone-100/80 text-sm">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-stone-700 transition-colors hover:bg-stone-200/50"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] text-stone-500">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className={`size-4 shrink-0 text-stone-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <pre className="max-h-64 overflow-auto border-t border-stone-300/80 bg-stone-900/95 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-stone-100">
          {details}
        </pre>
      ) : null}
    </div>
  );
}

export function ToolCallBlock({ body }: { body: string }) {
  const parsed = tryParseJson(body.trim()) as {
    tool_calls?: Array<{ name?: string; args?: unknown }>;
  } | null;
  const calls = parsed?.tool_calls ?? [];
  const name = calls[0]?.name ?? "tool";
  const args = calls[0]?.args;
  let subtitle: string | undefined;
  if (args && typeof args === "object" && args !== null) {
    const record = args as Record<string, unknown>;
    const query = record.query ?? record.brief;
    if (typeof query === "string" && query.trim()) {
      subtitle = query.trim();
    }
  }
  return (
    <ToolDetailsShell
      title={`Tool Selected: ${name}`}
      subtitle={subtitle}
      details={prettyJson(parsed ?? body)}
    />
  );
}

export function ToolResultBlock({ body }: { body: string }) {
  const trimmed = body.trim();
  const match = /^([a-zA-Z0-9_]+):\s*([\s\S]*)$/.exec(trimmed);
  const name = match?.[1] ?? "tool";
  const payloadRaw = match?.[2]?.trim() ?? trimmed;
  const payload = tryParseJson(payloadRaw);
  let subtitle: string | undefined;
  if (payload && typeof payload === "object" && payload !== null) {
    const record = payload as { studies?: unknown[]; ok?: boolean; error?: string };
    if (Array.isArray(record.studies)) {
      const count = record.studies.length;
      subtitle = count === 1 ? "1 study" : `${count} studies`;
    } else if (record.error) {
      subtitle = String(record.error);
    }
  }
  return (
    <ToolDetailsShell
      title={name === "tool" ? "Tool result" : `Result · ${name}`}
      subtitle={subtitle}
      details={prettyJson(payload ?? payloadRaw)}
    />
  );
}
