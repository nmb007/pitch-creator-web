"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PitchResults } from "@/features/pitch/pitch-results";

function PitchResultsForId() {
  const params = useSearchParams();
  const pitchId = params.get("id") ?? "missing";
  return <PitchResults key={pitchId} />;
}

export default function PitchPage() {
  return (
    <Suspense fallback={<p>Loading the pitch…</p>}>
      <PitchResultsForId />
    </Suspense>
  );
}
