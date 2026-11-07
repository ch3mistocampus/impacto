"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type Role = "field_worker" | "coordinator" | "donor" | "community";
const KEY = "impacto.session";

type SessionCtx = {
  sessionToken: string | undefined;
  user: { _id: string; name: string; role: Role } | null | undefined; // undefined = loading
  signInAs: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      // Hydrate from localStorage after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(localStorage.getItem(KEY) ?? undefined);
    } catch {}
  }, []);

  const user = useQuery(api.sessions.me, { sessionToken: token });
  const signInMut = useMutation(api.sessions.signInAsDemo);
  const signOutMut = useMutation(api.sessions.signOut);

  const signInAs = useCallback(
    async (role: Role) => {
      const { token: tk } = await signInMut({ role });
      setToken(tk);
      try {
        localStorage.setItem(KEY, tk);
      } catch {}
    },
    [signInMut],
  );

  const signOut = useCallback(async () => {
    if (token) await signOutMut({ sessionToken: token });
    setToken(undefined);
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }, [token, signOutMut]);

  return (
    <Ctx.Provider value={{ sessionToken: token, user: user ?? (user === null ? null : undefined), signInAs, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}
