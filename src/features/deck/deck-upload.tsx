"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";

export function DeckUpload() {
  const [deckId, setDeckId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deck = useQuery({
    queryKey: ["deck", deckId],
    enabled: deckId !== null,
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/decks/{deck_id}", {
        params: { path: { deck_id: deckId ?? "" } },
      });
      if (!data) {
        throw new Error("Case study status was empty.");
      }
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
  });

  const finished = deck.data?.status === "completed";
  const studies = useQuery({
    queryKey: ["studies", deckId],
    enabled: finished,
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/studies");
      return data ?? [];
    },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input = event.currentTarget.elements.namedItem("file");
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      setError("Choose a PowerPoint file.");
      return;
    }
    const body = new FormData();
    body.append("file", input.files[0]);
    setBusy(true);
    try {
      const { data } = await apiClient.POST("/v1/decks", {
        body: { file: "" },
        bodySerializer: () => body,
      });
      if (!data) {
        throw new Error("Upload did not return case studies.");
      }
      setDeckId(data.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input name="file" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
        <button
          className="w-fit rounded bg-emerald-900 px-4 py-2 text-white disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          Upload case studies
        </button>
      </form>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {deck.data ? (
        <section className="mt-6 rounded border border-stone-300 bg-white p-4">
          <p className="text-sm">
            {deck.data.file_name}: <strong>{deck.data.status}</strong>
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Added {deck.data.studies_added}, updated {deck.data.studies_updated}, hidden{" "}
            {deck.data.studies_hidden}.
          </p>
        </section>
      ) : null}
      {studies.data ? (
        <ul className="mt-6 flex flex-col gap-2">
          {studies.data.slice(0, 40).map((study) => (
            <li key={study.id} className="text-sm">
              <span className="text-stone-500">{study.section}</span> — {study.title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
