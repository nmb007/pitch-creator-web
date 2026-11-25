"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { apiClient } from "@/shared/api/client";
import { MarkdownBody } from "@/shared/ui/markdown-body";

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
          <h2 className="mb-3 text-sm font-medium text-stone-600">Selected case studies</h2>
          <ol className="flex flex-col gap-3">
            {studies.map((study) => (
              <li
                key={study.study_id}
                className="rounded-xl border border-stone-300 bg-white px-4 py-3"
              >
                <p className="text-xs text-stone-500">
                  {study.rank}. {study.section}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">{study.title}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
