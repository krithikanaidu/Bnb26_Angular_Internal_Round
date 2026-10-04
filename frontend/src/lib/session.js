import { create } from 'zustand';

const TOKEN_KEY = 'bb.session.token';
const USER_KEY = 'bb.session.user';

/**
 * Session store — the signed-in account and its bearer token.
 *
 * The token is the only thing that authorises API calls, so it is read
 * straight from localStorage on every request (see lib/api.js). If it is
 * missing, expired, or rejected by the backend, `onUnauthorized` clears both
 * the store and storage, and the route guard sends the user back to /login.
 *
 * Nothing about the workspace lives here: projects, scripts and clips always
 * come from the API, never from cached client state.
 */

const readToken = () => {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
const readUser = () => {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const persist = (token, user) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode / disabled storage: the session still works in-memory */
  }
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export const useSession = create((set, get) => ({
  token: readToken(),
  user: readUser(),
  /** True while the token is present but we have not confirmed it with /api/auth/me yet. */
  checking: Boolean(readToken()),

  setSession: (token, user) => {
    persist(token, user);
    set({ token: token || '', user: user || null, checking: false });
  },

  /** Confirms the stored token is still valid; clears it if it is not. */
  verify: async () => {
    const token = get().token;
    if (!token) {
      set({ user: null, checking: false });
      return null;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`session rejected (${res.status})`);
      const { user } = await res.json();
      set({ user, checking: false });
      return user;
    } catch (e) {
      persist('', null);
      set({ token: '', user: null, checking: false });
      return null;
    }
  },

  logout: () => {
    persist('', null);
    set({ token: '', user: null, checking: false });
  },

  /** Called by the axios interceptor on any 401 from a workspace endpoint. */
  handleUnauthorized: () => {
    if (!get().token) return;
    persist('', null);
    set({ token: '', user: null, checking: false });
    onUnauthorized();
  },
}));

export const getToken = readToken;
