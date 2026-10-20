import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokenStore } from '../api/client';
import type { AuthSession, RegisterInput, User } from '../api/types';

export interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const start = useCallback((session: AuthSession) => {
    tokenStore.set(session.accessToken);
    setUser(session.user);
    return session.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => start(await api.login(email, password)),
      register: async (input) => start(await api.register(input)),
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, loading, start],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
