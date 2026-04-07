import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

interface AuthContextValue {
  isAuthReady: boolean;
  isSupabaseConfigured: boolean;
  session: Session | null;
  user: User | null;
  profile: Database["public"]["Tables"]["users"]["Row"] | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfileSafely(userId: string) {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, name, phone, created_at, trial_started_at, trial_ends_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Failed to fetch user row", error.message);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.warn("Failed to fetch user row", error);
    return null;
  }
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!error) {
    return false;
  }

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  const normalized = message.toLowerCase();
  return normalized.includes("invalid refresh token") || normalized.includes("refresh token not found");
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(
    null,
  );
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    async function bootstrap() {
      const client = supabase;

      if (!isMounted) {
        return;
      }

      if (!isSupabaseConfigured || !client) {
        setIsAuthReady(true);
        return;
      }

      try {
        const {
          data: { session: currentSession },
        } = await client.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user?.id) {
          const nextProfile = await fetchProfileSafely(currentSession.user.id);

          if (isMounted) {
            setProfile(nextProfile);
          }
        } else {
          setProfile(null);
        }

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange(async (_event, nextSession) => {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);

          if (!nextSession) {
            setProfile(null);
            return;
          }

          const nextProfile = await fetchProfileSafely(nextSession.user.id);
          setProfile(nextProfile);
        });

        unsubscribe = () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.warn("Failed to bootstrap auth state", error);

        if (isInvalidRefreshTokenError(error) && client) {
          try {
            await client.auth.signOut({ scope: "local" });
          } catch (signOutError) {
            console.warn("Failed to clear invalid auth session", signOutError);
          }
        }

        if (isMounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthReady,
      isSupabaseConfigured,
      session,
      user,
      profile,
      async signIn(email, password) {
        const client = assertSupabaseConfigured();
        const { error } = await client.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }
      },
      async signUp(email, password) {
        const client = assertSupabaseConfigured();
        const { error } = await client.auth.signUp({ email, password });

        if (error) {
          throw error;
        }
      },
      async sendPasswordReset(email) {
        const client = assertSupabaseConfigured();
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: "notaro://auth/update-password",
        });

        if (error) {
          throw error;
        }
      },
      async updatePassword(password) {
        const client = assertSupabaseConfigured();
        const { error } = await client.auth.updateUser({ password });

        if (error) {
          throw error;
        }
      },
      async signOut() {
        const client = assertSupabaseConfigured();
        const { error } = await client.auth.signOut();

        if (error) {
          throw error;
        }

        setSession(null);
        setUser(null);
        setProfile(null);
      },
      async resetAuth() {
        const client = supabase;

        if (client) {
          try {
            await client.auth.signOut({ scope: "local" });
          } catch (error) {
            console.warn("Failed to reset local auth session", error);
          }
        }

        setSession(null);
        setUser(null);
        setProfile(null);
      },
    }),
    [isAuthReady, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
