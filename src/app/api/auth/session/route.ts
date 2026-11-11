import { endSession, readSessionEnv, startSession } from "@/lib/auth/session-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return startSession(req, readSessionEnv());
}

export async function DELETE(req: Request) {
  return endSession(req, readSessionEnv());
}
