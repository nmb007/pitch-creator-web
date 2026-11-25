"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PitchView } from "@/features/pitch/pitch-view";

function PitchViewForId() {
  const params = useSearchParams();
  const pitchId = params.get("id") ?? "missing";
  return <PitchView key={pitchId} />;
}

export default function PitchViewPage() {
  return (
    <Suspense fallback={<p>Loading the pitch…</p>}>
      <PitchViewForId />
    </Suspense>
  );
}
