import React, { createContext, PropsWithChildren, useContext, useMemo } from "react";

interface AuthModalContextValue {
  requestShellClose: (callback: () => void) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({
  children,
  requestShellClose,
}: PropsWithChildren<{ requestShellClose: (callback: () => void) => void }>) {
  const value = useMemo<AuthModalContextValue>(
    () => ({
      requestShellClose,
    }),
    [requestShellClose],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);

  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }

  return context;
}
