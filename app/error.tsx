"use client";

import { Button, Eyebrow } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <Eyebrow className="justify-center">Something went wrong</Eyebrow>
      <h1 className="mt-4 text-5xl font-medium">
        That didn&apos;t <em className="text-gold-500">load</em>
      </h1>
      <p className="mt-4 text-body">Your saved jobs, letters and profile are safe in this browser. Try again, and if it keeps happening, refresh the page.</p>
      <Button onClick={reset} className="mt-8 px-6 py-3">
        Try again
      </Button>
    </div>
  );
}
