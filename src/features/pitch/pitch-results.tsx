"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { apiClient } from "@/shared/api/client";

export function PitchResults() {
  const params = useSearchParams();
  const pitchId = params.get("id");

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
    refetchInterval: (query) =>
      query.state.data?.status === "collecting" ? 2000 : false,
  });

  const matches = useQuery({
    queryKey: ["matches", pitchId, pitch.data?.status],
    enabled: pitch.data?.status === "selecting",
    queryFn: async () => {
      const { data } = await apiClient.GET("/v1/pitches/{pitch_id}/matches", {
        params: { path: { pitch_id: pitchId ?? "" } },
      });
      return data ?? [];
    },
  });

  if (!pitchId) {
    return <p>This page needs a pitch id.</p>;
  }
  if (pitch.isPending) {
    return <p>Loading the pitch…</p>;
  }
  if (pitch.isError) {
    return <p className="text-red-700">The pitch could not be loaded.</p>;
  }

  return (
    <main>
      <h1 className="text-3xl font-semibold">Closest studies</h1>
      <p className="mt-2 text-sm text-stone-600">Status: {pitch.data.status}</p>
      {pitch.data.status === "collecting" ? (
        <p className="mt-4 text-sm">Searching the deck…</p>
      ) : null}
      <ul className="mt-6 flex flex-col gap-4">
        {(matches.data ?? []).map((match) => (
          <li key={`${match.study_id}-${match.rank}`} className="rounded border border-stone-300 bg-white p-4">
            <p className="text-sm text-stone-500">
              {match.rank}. {match.section}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{match.title}</h2>
            <p className="mt-3 text-sm">{match.reason}</p>
            <blockquote className="mt-3 border-l-2 border-stone-300 pl-3 text-sm text-stone-600">
              {match.source_quote}
            </blockquote>
          </li>
        ))}
      </ul>
    </main>
  );
}
