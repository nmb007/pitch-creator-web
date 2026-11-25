"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { apiClient } from "@/shared/api/client";
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

  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-6 border-b border-stone-300 pb-4">
        <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
          Generated pitch
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">{page.data.title}</h1>
      </header>

      <section className="mb-8">
        <MarkdownBody content={page.data.body} className="text-sm leading-relaxed text-stone-800" />
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
