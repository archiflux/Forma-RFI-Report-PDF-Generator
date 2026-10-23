"use client";

import { Button } from "@/components/ui/button";

// Catches rendering errors in any signed-in page so one bad record shows a
// message instead of a blank "Application error" screen.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
      <p className="font-semibold">Something went wrong building this page.</p>
      <p className="mt-2 break-words font-mono text-xs">{error.message}</p>
      <p className="mt-2">Try again, or select fewer projects. If it keeps happening, send this message to whoever maintains the app.</p>
      <Button className="mt-4" size="sm" onClick={reset}>Try again</Button>
    </div>
  );
}
