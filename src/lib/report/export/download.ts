// Browser-only download helper. Never import in tests.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Safe filename derivation that keeps intent but strips path separators,
// quotes, and other characters Windows/macOS dislike.
export function safeFilename(stem: string, ext: "pdf" | "csv" | "json"): string {
  const cleaned = stem
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${cleaned || "rfi-report"}-${stamp}.${ext}`;
}
