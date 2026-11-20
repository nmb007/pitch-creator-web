"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";

export function NewPitchForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const both = message.trim().length > 0 && file !== null;
  const empty = message.trim().length === 0 && file === null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (both || empty) {
      setError("Send a message or a file, not both.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = file
        ? await sendFile(file)
        : await sendMessage(message.trim());
      router.push(`/pitch?id=${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The pitch could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea
          className="min-h-32 rounded border border-stone-300 bg-white px-3 py-2"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        File (.txt, .pdf, or .docx)
        <input
          type="file"
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {both ? (
        <p className="text-sm text-red-700">Clear the message or the file. Only one can be sent.</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="w-fit rounded bg-emerald-900 px-4 py-2 text-white disabled:opacity-60"
        type="submit"
        disabled={busy || both || empty}
      >
        Find studies
      </button>
    </form>
  );
}

async function sendMessage(message: string) {
  const { data } = await apiClient.POST("/v1/pitches", {
    body: { message },
    headers: { "Content-Type": "application/json" },
  });
  if (!data) {
    throw new Error("The pitch was not created.");
  }
  return data;
}

async function sendFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  const { data } = await apiClient.POST("/v1/pitches", {
    body: { file: "" },
    bodySerializer: () => body,
  });
  if (!data) {
    throw new Error("The pitch was not created.");
  }
  return data;
}
