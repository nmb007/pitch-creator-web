"use client";

import { ArrowUp, FileText, Plus, Search, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { ApiError } from "@/shared/api/errors";
import { createPitchStream, readPitchSse } from "@/shared/api/sse";

const FILE_ACCEPT =
  ".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SUGGESTIONS = [
  {
    id: "upload",
    label: "Upload a brief",
    icon: Upload,
    action: "upload" as const,
  },
  {
    id: "rfp",
    label: "Paste an RFP or brief",
    icon: FileText,
    action: "fill" as const,
    prompt: "Here is an RFP / brief to pitch against:\n\n",
  },
  {
    id: "brand",
    label: "Find studies for a brand",
    icon: Search,
    action: "fill" as const,
    prompt: "Find relevant studies for this brand: ",
  },
] as const;

export function NewPitchForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const both = message.trim().length > 0 && file !== null;
  const empty = message.trim().length === 0 && file === null;
  const canSubmit = !busy && !both && !empty;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (both || empty) {
      setError("Send a message or a file, not both.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await createPitchStream(
        file ? { file } : { message: message.trim() },
      );
      let pitchId: string | null = null;
      await readPitchSse(response, (event, data) => {
        if (event === "ready" && typeof data.pitch_id === "string") {
          pitchId = data.pitch_id;
        }
        if (event === "error") {
          throw new Error(String(data.detail ?? "The pitch could not be started."));
        }
      });
      if (!pitchId) {
        throw new Error("The pitch was not created.");
      }
      router.replace(`/pitch?id=${pitchId}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "The pitch could not be started.");
    } finally {
      setBusy(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(selected: File | null) {
    setFile(selected);
    if (selected) {
      setMessage("");
      setError(null);
    }
  }

  function onMessageChange(value: string) {
    setMessage(value);
    if (value.trim().length > 0 && file) {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="text-center text-3xl font-medium tracking-tight text-stone-800">
        Ready when you are.
      </h1>

      <form className="mt-8 w-full" onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />

        <div className="rounded-[1.75rem] border border-stone-300/80 bg-white px-3 py-2 shadow-[0_8px_40px_-12px_rgba(28,25,21,0.18)]">
          {file ? (
            <div className="mb-2 flex items-center gap-2 px-2 pt-1">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-stone-500 hover:bg-stone-200 hover:text-stone-800"
                  aria-label="Remove file"
                  onClick={clearFile}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </div>
          ) : null}

          <div className="flex items-end gap-1">
            <button
              type="button"
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              aria-label="Attach a file"
              onClick={openFilePicker}
              disabled={busy}
            >
              <Plus className="size-5" strokeWidth={1.75} />
            </button>

            <textarea
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-stone-800 outline-none placeholder:text-stone-400"
              rows={1}
              placeholder="Describe your pitch…"
              value={message}
              disabled={busy}
              onChange={(event) => {
                onMessageChange(event.target.value);
                autoResize(event.currentTarget);
              }}
              onKeyDown={onKeyDown}
            />

            <button
              type="submit"
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition disabled:opacity-40"
              aria-label="Start pitch"
              disabled={!canSubmit}
            >
              <ArrowUp className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {both ? (
          <p className="mt-3 text-sm text-red-700">
            Clear the message or the file. Only one can be sent.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {busy ? <p className="mt-3 text-sm text-stone-500">Starting the conversation…</p> : null}
      </form>

      <ul className="mt-5 w-full space-y-1">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <li key={suggestion.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm text-stone-500 transition hover:bg-stone-200/50 hover:text-stone-800"
                disabled={busy}
                onClick={() => {
                  if (suggestion.action === "upload") {
                    openFilePicker();
                    return;
                  }
                  onMessageChange(suggestion.prompt);
                }}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>{suggestion.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function autoResize(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
}
