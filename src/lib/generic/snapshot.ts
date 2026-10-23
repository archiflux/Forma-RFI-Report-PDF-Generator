import { z } from "zod";
import type { BaseRecord, GenericDataset } from "./types";

// Structural check for shared generic datasets. Records keep their
// module-specific fields (passthrough); the view only reads strings and
// optional strings from them and React escapes all text.
const Schema = z.object({
  projects: z.array(z.object({ id: z.string(), name: z.string(), count: z.number() }).passthrough()),
  items: z.array(
    z
      .object({ key: z.string(), id: z.string(), projectId: z.string(), projectName: z.string(), custom: z.record(z.string()).optional() })
      .catchall(z.union([z.string(), z.number(), z.boolean(), z.undefined(), z.record(z.string())])),
  ),
});

export function parseGenericDataset<T extends BaseRecord>(json: unknown): GenericDataset<T> {
  return Schema.parse(json) as unknown as GenericDataset<T>;
}
