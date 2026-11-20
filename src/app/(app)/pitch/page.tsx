import { Suspense } from "react";

import { PitchResults } from "@/features/pitch/pitch-results";

export default function PitchPage() {
  return (
    <Suspense fallback={<p>Loading the pitch…</p>}>
      <PitchResults />
    </Suspense>
  );
}
