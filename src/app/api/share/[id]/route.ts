import { getStore } from "@/lib/share/store";
import { fetchShared, notConfigured, readShareEnv, removeShared } from "@/lib/share/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const store = getStore();
  return store ? fetchShared((await ctx.params).id, store) : notConfigured();
}

export async function DELETE(req: Request, ctx: Ctx) {
  const store = getStore();
  return store ? removeShared(req, (await ctx.params).id, store, readShareEnv()) : notConfigured();
}
