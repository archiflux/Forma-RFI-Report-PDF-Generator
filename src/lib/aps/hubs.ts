import type { ApsClient } from "./client";
import type { Hub } from "./types";

interface RawHubsResponse {
  data?: Array<{
    id: string;
    attributes?: {
      name?: string;
      region?: string;
      extension?: { type?: string };
    };
  }>;
}

export async function listHubs(client: ApsClient): Promise<Hub[]> {
  const res = await client.request<RawHubsResponse>({ path: "/project/v1/hubs" });
  const hubs = (res.data ?? []).map((h) => ({
    id: h.id,
    name: h.attributes?.name ?? h.id,
    region: h.attributes?.region,
    extensionType: h.attributes?.extension?.type,
  }));
  // Forma/ACC hubs surface as extension types beginning with "hubs:autodesk.bim360:"
  // or "hubs:autodesk.core:" depending on account age. Keep both; filter only
  // personal hubs (which don't have RFIs).
  return hubs.filter((h) => !h.extensionType?.includes("personal"));
}
