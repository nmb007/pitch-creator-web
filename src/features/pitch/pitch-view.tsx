"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";
import { MarkdownBody } from "@/shared/ui/markdown-body";

type PageStudy = components["schemas"]["PageStudyResponse"];

const STUDY_SECTIONS: { key: keyof PageStudy; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "challenge", label: "Challenge" },
  { key: "approach", label: "Approach" },
  { key: "solution", label: "Solution" },
  { key: "outcome", label: "Outcome" },
  { key: "tech_stack", label: "Tech stack" },
];

function studySections(study: PageStudy): { label: string; text: string }[] {
  const sections: { label: string; text: string }[] = [];
  for (const { key, label } of STUDY_SECTIONS) {
    const value = study[key];
    if (typeof value !== "string") {
      continue;
    }
    const text = value.trim();
    if (!text) {
      continue;
    }
    sections.push({ label, text });
  }
  return sections;
}

function StudyAccordionItem({ study }: { study: PageStudy }) {
  const [open, setOpen] = useState(false);
  const sections = studySections(study);

  return (
    <li className="overflow-hidden rounded-xl border border-stone-300 bg-white">
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight
          className={`mt-0.5 size-4 shrink-0 text-stone-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1">
          <p className="text-xs text-stone-500">
            {study.rank}. {study.section}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-stone-800">{study.title}</p>
        </span>
      </button>
      {open ? (
        <div className="border-t border-stone-200 px-4 py-3">
          {sections.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
                    {section.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-stone-700">
                    {section.text}
                  </p>
                </div>
              ))}
            </div>
          ) : study.raw_text?.trim() ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700">
              {study.raw_text.trim()}
            </p>
          ) : (
            <p className="text-sm text-stone-500">No details available for this study.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function PitchView() {
  const params = useSearchParams();
  const pitchId = params.get("id");
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const page = useQuery({
    queryKey: ["pitch-page", pitchId],
    enabled: Boolean(pitchId),
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/page", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      if (!data) {
        throw new Error("This pitch page was not found.");
      }
      return data;
    },
  });

  useEffect(() => {
    if (!page.data || editing) {
      return;
    }
    setDraftTitle(page.data.title);
    setDraftBody(page.data.body);
  }, [page.data, editing]);

  function startEditing() {
    if (!page.data) {
      return;
    }
    setDraftTitle(page.data.title);
    setDraftBody(page.data.body);
    setShowPreview(false);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
    setShowPreview(false);
    if (page.data) {
      setDraftTitle(page.data.title);
      setDraftBody(page.data.body);
    }
  }

  async function saveEdits() {
    if (!pitchId || saving) {
      return;
    }
    const title = draftTitle.trim();
    const body = draftBody.trim();
    if (!title || !body) {
      setSaveError("Title and body are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await apiClient.PATCH("/v1/pitches/{pitch_id}/page", {
        params: { path: { pitch_id: pitchId } },
        body: { title, body },
      });
      if (!data) {
        throw new Error("The pitch could not be saved.");
      }
      queryClient.setQueryData(["pitch-page", pitchId], data);
      setEditing(false);
      setShowPreview(false);
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The pitch could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!pitchId) {
    return <p>This page needs a pitch id.</p>;
  }
  if (page.isPending) {
    return <p>Loading the pitch…</p>;
  }
  if (page.isError) {
    return (
      <p className="text-red-700">
        {page.error instanceof Error ? page.error.message : "The pitch page could not be loaded."}
      </p>
    );
  }

  const studies = page.data.studies ?? [];
  const canSave = draftTitle.trim().length > 0 && draftBody.trim().length > 0 && !saving;

  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-6 border-b border-stone-300 pb-4">
        <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
          Generated pitch
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          {editing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-2xl font-semibold text-stone-900 outline-none focus:border-[var(--accent)]"
              aria-label="Pitch title"
            />
          ) : (
            <h1 className="min-w-0 flex-1 text-2xl font-semibold text-stone-900">
              {page.data.title}
            </h1>
          )}
          {!editing ? (
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900"
              onClick={startEditing}
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
              Edit
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={cancelEditing}
                disabled={saving}
              >
                <X className="size-3.5" strokeWidth={1.75} />
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void saveEdits()}
                disabled={!canSave}
              >
                <Check className="size-3.5" strokeWidth={2} />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
        {saveError ? <p className="mt-2 text-sm text-red-700">{saveError}</p> : null}
      </header>

      <section className="mb-8">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                Body (Markdown)
              </p>
              <button
                type="button"
                className="cursor-pointer text-xs font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
                onClick={() => setShowPreview((current) => !current)}
              >
                {showPreview ? "Edit Markdown" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <div className="rounded-xl border border-stone-300 bg-white px-4 py-3">
                <MarkdownBody
                  content={draftBody}
                  className="text-sm leading-relaxed text-stone-800"
                />
              </div>
            ) : (
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={18}
                className="w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-stone-800 outline-none focus:border-[var(--accent)]"
                aria-label="Pitch body"
                spellCheck
              />
            )}
          </div>
        ) : (
          <MarkdownBody
            content={page.data.body}
            className="text-sm leading-relaxed text-stone-800"
          />
        )}
      </section>

      {studies.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-stone-600">Relevant experience</h2>
          <ul className="flex flex-col gap-3">
            {studies.map((study) => (
              <StudyAccordionItem key={study.study_id} study={study} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
