import { DeckUpload } from "@/features/deck/deck-upload";

export default function DecksPage() {
  return (
    <main>
      <h1 className="text-3xl font-semibold">Master deck</h1>
      <p className="mt-2 text-sm text-stone-600">
        Upload the case-study PowerPoint. The page waits until the import
        finishes.
      </p>
      <DeckUpload />
    </main>
  );
}
