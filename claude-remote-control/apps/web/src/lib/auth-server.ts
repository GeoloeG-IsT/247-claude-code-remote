// Lazy initialization to avoid errors during build when env vars aren't available
// All imports are dynamic to prevent module evaluation at build time

type AuthServer = Awaited<
  ReturnType<typeof import('@neondatabase/auth/next/server').createAuthServer>
>;

let _authServer: AuthServer | null = null;

export async function getAuthServer(): Promise<AuthServer> {
  if (!_authServer) {
    const { createAuthServer } = await import('@neondatabase/auth/next/server');
    _authServer = createAuthServer();
  }
  return _authServer;
}

// Re-export helpers that require dynamic import
export async function getNeonAuth() {
  const { neonAuth } = await import('@neondatabase/auth/next/server');
  return neonAuth;
}

export async function getAuthApiHandler() {
  const { authApiHandler } = await import('@neondatabase/auth/next/server');
  return authApiHandler;
}
