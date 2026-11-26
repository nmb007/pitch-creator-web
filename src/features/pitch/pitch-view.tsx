"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiClient } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { components } from "@/shared/api/schema";
import { MarkdownBody } from "@/shared/ui/markdown-body";

type PageStudy = components["schemas"]["PageStudyResponse"];
type PageData = components["schemas"]["PageResponse"];

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

function StudyAccordionItem({
  study,
  busy,
  onRemove,
}: {
  study: PageStudy;
  busy: boolean;
  onRemove: (rewrite: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rewriteMode, setRewriteMode] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sections = studySections(study);
  const dialogBusy = busy || submitting;

  function openConfirm() {
    setDialogError(null);
    setSubmitting(false);
    setRewriteMode(false);
    dialogRef.current?.showModal();
  }

  function closeConfirm() {
    if (submitting) {
      return;
    }
    dialogRef.current?.close();
    setDialogError(null);
    setRewriteMode(false);
  }

  async function choose(rewrite: boolean) {
    if (dialogBusy) {
      return;
    }
    setSubmitting(true);
    setRewriteMode(rewrite);
    setDialogError(null);
    try {
      await onRemove(rewrite);
      dialogRef.current?.close();
      setRewriteMode(false);
    } catch (caught) {
      setDialogError(
        caught instanceof Error ? caught.message : "The case study could not be removed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-xl border border-stone-300 bg-white">
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          disabled={dialogBusy}
        >
          <ChevronRight
            className={`mt-0.5 size-4 shrink-0 text-stone-400 transition-transform ${
              open ? "rotate-90" : ""
            }`}
            strokeWidth={1.75}
          />
          <span className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-800">{study.title}</p>
          </span>
        </button>
        <button
          type="button"
          className="mt-3 mr-3 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Remove ${study.title}`}
          title="Remove case study"
          disabled={dialogBusy}
          onClick={(event) => {
            event.stopPropagation();
            openConfirm();
          }}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
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

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(100%,24rem)] rounded-2xl border border-stone-300 bg-[var(--paper)] p-0 text-stone-800 shadow-lg backdrop:bg-stone-900/40"
        onCancel={(event) => {
          if (submitting) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current && !submitting) {
            closeConfirm();
          }
        }}
      >
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">Remove case study</h3>
          {submitting ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
              <Loader2
                className="size-4 shrink-0 animate-spin text-stone-600"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-sm text-stone-700">
                {rewriteMode
                  ? "Rewriting pitch description…"
                  : "Removing case study…"}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Remove <span className="font-medium text-stone-800">{study.title}</span> from
                this pitch?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">
                Updating the description will replace the current title and body, including any
                edits you have made.
              </p>
            </>
          )}
          {dialogError ? <p className="mt-3 text-sm text-red-700">{dialogError}</p> : null}
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={dialogBusy}
              onClick={() => void choose(false)}
            >
              Remove only
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-amber-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={dialogBusy}
              onClick={() => void choose(true)}
            >
              Remove and update description
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={dialogBusy}
              onClick={closeConfirm}
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
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
  const [removingStudyId, setRemovingStudyId] = useState<string | null>(null);
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

  function applyPageData(data: PageData) {
    queryClient.setQueryData(["pitch-page", pitchId], data);
    if (!editing) {
      setDraftTitle(data.title);
      setDraftBody(data.body);
    }
  }

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
      applyPageData(data);
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

  async function removeStudy(studyId: string, rewrite: boolean) {
    if (!pitchId || removingStudyId) {
      throw new Error("Another remove is already in progress.");
    }
    setRemovingStudyId(studyId);
    try {
      const { data } = await apiClient.DELETE("/v1/pitches/{pitch_id}/page/studies/{study_id}", {
        params: {
          path: { pitch_id: pitchId, study_id: studyId },
          query: { rewrite },
        },
      });
      if (!data) {
        throw new Error("The case study could not be removed.");
      }
      applyPageData(data);
      toast.success(
        rewrite ? "Case study removed and description updated." : "Case study removed.",
      );
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The case study could not be removed.";
      throw new Error(message);
    } finally {
      setRemovingStudyId(null);
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
  const busy = Boolean(removingStudyId) || saving;

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
              disabled={busy}
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
              <StudyAccordionItem
                key={study.study_id}
                study={study}
                busy={busy}
                onRemove={(rewrite) => removeStudy(study.study_id, rewrite)}
              />
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-medium text-stone-600">Relevant experience</h2>
          <p className="text-sm text-stone-500">No case studies are selected for this pitch.</p>
        </section>
      )}
    </main>
  );
}
