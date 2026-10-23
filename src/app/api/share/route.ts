import { getStore } from "@/lib/share/store";
import { listMine, notConfigured, publish, readShareEnv } from "@/lib/share/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const store = getStore();
  return store ? publish(req, store, readShareEnv()) : notConfigured();
}

export async function GET(req: Request) {
  const store = getStore();
  return store ? listMine(req, store, readShareEnv()) : notConfigured();
}
