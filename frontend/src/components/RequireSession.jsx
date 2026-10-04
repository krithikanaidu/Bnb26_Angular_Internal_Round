import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '../lib/session';

/**
 * RequireSession — gate for the workspace.
 *
 * Confirms the stored token with `GET /api/auth/me` before letting anyone in,
 * so a token that has expired (or one signed with a different AUTH_SECRET after
 * a redeploy) redirects to /login instead of dropping the user into a screen
 * where every request 401s.
 *
 * `PublicOnly` is the mirror: /login is pointless once you are already in, and
 * so is a second marketing visit from inside the app.
 */
export function RequireSession({ children }) {
  const location = useLocation();
  const token = useSession((s) => s.token);
  const checking = useSession((s) => s.checking);
  const verify = useSession((s) => s.verify);

  useEffect(() => {
    if (token && checking) verify();
  }, [token, checking, verify]);

  if (checking) {
    return (
      <div className="layout min-h-screen grid place-items-center">
        <p className="mono-xs muted">Checking your session…</p>
      </div>
    );
  }

  if (!token) {
    // Remember where they were headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function PublicOnly({ children }) {
  const token = useSession((s) => s.token);
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}
