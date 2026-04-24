import type { NextRequest } from "next/server";
import { proxyApsRequest } from "@/lib/aps/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const body = req.method === "GET" ? undefined : await req.text();
  return proxyApsRequest({
    method: req.method,
    path: `/${path.join("/")}`,
    query: req.nextUrl.searchParams,
    authorization: req.headers.get("authorization"),
    body,
  });
}

export const GET = handle;
export const POST = handle;
// PUT/PATCH/DELETE intentionally not exported — Next returns 405 for them.
