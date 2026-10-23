// Shared (hosted) snapshot. The body is gzipped JSON of a SharedSnapshot;
// the meta record is what the owner sees in "My shared links".

export type SnapshotKind = "issues" | "forms" | "reviews" | "rfis" | "submittals";

export interface SnapshotMeta {
  id: string;
  kind: SnapshotKind;
  title: string;
  createdAt: string;
  expiresAt: string;
  redacted: boolean;
  itemCount: number;
}

export interface SharedSnapshot extends SnapshotMeta {
  version: 2;
  // Dataset for the dashboard named by `kind`; validated by the viewer.
  data: unknown;
}

export const EXPIRY_DAYS = [7, 30, 90] as const;
export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024; // gzipped; Vercel caps request bodies at 4.5 MB
