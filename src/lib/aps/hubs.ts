import type { ApsClient } from "./client";
import type { Hub, HubKind } from "./types";

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

// Autodesk's hub `extension.type` discriminator. Empirically observed values:
//   "hubs:autodesk.bim360:Account"   → ACC / Forma business hub (has RFIs)
//   "hubs:autodesk.core:Hub"         → Fusion / personal Autodesk hub
//   "hubs:autodesk.a360:PersonalHub" → legacy A360 personal hub
// We classify but do NOT filter — a user with only personal hubs should
// still see something, with a clear indicator of why those hubs won't have RFIs.
export function classifyHub(extensionType: string | undefined): HubKind {
  if (!extensionType) return "unknown";
  const t = extensionType.toLowerCase();
  if (t.includes("bim360") || t.includes("acc") || t.includes("construction")) {
    return "acc";
  }
  if (
    t.includes("personal") ||
    t.includes("autodesk.core:hub") ||
    t.includes("a360")
  ) {
    return "personal";
  }
  return "unknown";
}

export async function listHubs(client: ApsClient): Promise<Hub[]> {
  const res = await client.request<RawHubsResponse>({ path: "/project/v1/hubs" });
  return (res.data ?? []).map((h) => {
    const extensionType = h.attributes?.extension?.type;
    return {
      id: h.id,
      name: h.attributes?.name ?? h.id,
      region: h.attributes?.region,
      extensionType,
      kind: classifyHub(extensionType),
    };
  });
}
