"use client";

import { useMemo } from "react";
import { ApsClient } from "./client";
import { useAuth } from "@/lib/auth/store";

export function useApsClient(): ApsClient {
  const getAccessToken = useAuth((s) => s.getAccessToken);
  const getFreshToken = useAuth((s) => s.ensureFreshToken);
  return useMemo(() => new ApsClient({ getAccessToken, getFreshToken }), [getAccessToken, getFreshToken]);
}
