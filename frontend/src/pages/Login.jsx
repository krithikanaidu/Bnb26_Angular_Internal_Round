import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, UserPlus } from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { ErrorNote } from '../ui/AppKit';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AsteriskBurst } from '../ui/DoodleOutline';
import { GridPaperBg } from '../ui/SkyBackground';

/**
 * Login — sign in, or create the first account on a fresh database.
 *
 * Both modes hit the real endpoints (`POST /api/auth/login`,
 * `POST /api/auth/register`); the token that comes back is stored and sent as a
 * bearer token on every workspace request. Errors are whatever the backend
 * said, not a generic "something went wrong".
 */
export default function Login() {
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);
  const token = useSession((s) => s.token);
  const user = useSession((s) => s.user);

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState(null);

  // Already signed in? Go straight to the workspace.
  useEffect(() => {
    if (token && user) navigate('/dashboard', { replace: true });
  }, [token, user, navigate]);

  // A brand new database has no accounts, so the sign-in form would be a dead
  // end. We look, and if there are none we open on "create one" instead of
  // making the user discover the problem.
  useEffect(() => {
    let active = true;
    api
      .get('/auth/count')
      .then(({ data }) => active && setAccounts(data?.count ?? null))
      .catch(() => active && setAccounts(null));
    return () => {
      active = false;
    };
  }, []);

  const isRegister = mode === 'register';
  const canSubmit = !busy && email.trim() !== '' && password !== '' && (!isRegister || name.trim() !== '');

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(isRegister ? '/auth/register' : '/auth/login', {
        email: email.trim(),
        password,
        ...(isRegister ? { name: name.trim() } : {}),
      });
      setSession(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      <GridPaperBg />
      <div className="bb-grain" aria-hidden="true" />

      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <ThemeToggle />
        <Link to="/" className="btn ghost tiny">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
      </div>

      <div className="auth-wrap">
        <div className="auth-card">
          <div className="flex items-center gap-2 mb-6">
            <AsteriskBurst size={24} />
            <span className="font-display font-black text-xl tracking-tight">
              Bit<span style={{ color: 'var(--hot-pink)' }}>&amp;</span>Build
            </span>
          </div>

          <div className="card card-taped">
            <div className="auth-seg mb-5" role="tablist" aria-label="Sign in or create an account">
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={`btn tiny ${isRegister ? 'ghost' : 'primary'}`}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={`btn tiny ${isRegister ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create account
              </button>
            </div>

            <h1 className="font-display font-black text-2xl tracking-tight">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="muted text-sm mt-1 mb-5">
              {isRegister
                ? 'One account owns the workspace. Pick an email and a passphrase of at least 8 characters.'
                : accounts === 0
                  ? 'This database has no accounts yet — create the first one to continue.'
                  : 'Sign in to open your projects, scripts, clips and schedule.'}
            </p>

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              {isRegister && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="auth-name">Name</label>
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How you appear in the workspace"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={isRegister ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <button type="submit" className="btn primary mt-1" disabled={!canSubmit}>
                {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <p className="mono-xs muted mt-4 text-center">
            Sessions are signed JWTs held in this browser. Clearing site data signs you out.
          </p>
        </div>
      </div>
    </div>
  );
}
