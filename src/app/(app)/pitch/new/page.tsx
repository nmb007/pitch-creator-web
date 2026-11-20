import { NewPitchForm } from "@/features/pitch/new-pitch-form";

export default function NewPitchPage() {
  return (
    <main>
      <h1 className="text-3xl font-semibold">New pitch</h1>
      <p className="mt-2 text-sm text-stone-600">
        Send one chat message or one file. The two cannot be submitted together.
      </p>
      <NewPitchForm />
    </main>
  );
}
