import { readSessionEnv, refreshSession } from "@/lib/auth/session-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return refreshSession(req, readSessionEnv());
}
