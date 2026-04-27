"use client";

import { create } from "zustand";
import type { TokenSet } from "@/lib/aps/auth";
import { refreshTokens, signOut as apsSignOut } from "@/lib/aps/auth";

interface AuthState {
  tokens: TokenSet | null;
  setTokens: (t: TokenSet | null) => void;
  getAccessToken: () => string | null;
  ensureFreshToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const REFRESH_SKEW_MS = 60_000;

export const useAuth = create<AuthState>((set, get) => ({
  tokens: null,

  setTokens: (t) => set({ tokens: t }),

  getAccessToken: () => get().tokens?.accessToken ?? null,

  ensureFreshToken: async () => {
    const current = get().tokens;
    if (current && current.expiresAt - REFRESH_SKEW_MS > Date.now()) {
      return current.accessToken;
    }
    const refreshed = await refreshTokens();
    if (refreshed) {
      set({ tokens: refreshed });
      return refreshed.accessToken;
    }
    set({ tokens: null });
    return null;
  },

  signOut: async () => {
    const current = get().tokens;
    set({ tokens: null });
    // Drop any cached RFI/Issue payloads so the next sign-in (which may be
    // a different Autodesk user) doesn't see the previous user's data.
    if (typeof window !== "undefined") {
      try {
        const ss = window.sessionStorage;
        const drop: string[] = [];
        for (let i = 0; i < ss.length; i++) {
          const k = ss.key(i);
          if (k && k.startsWith("forma-rfi:")) drop.push(k);
        }
        for (const k of drop) ss.removeItem(k);
      } catch {
        // sessionStorage blocked — nothing to clean up.
      }
    }
    await apsSignOut(current?.accessToken ?? null);
  },
}));
