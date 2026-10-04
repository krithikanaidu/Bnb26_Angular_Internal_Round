import axios from 'axios';
import { getToken, useSession } from './session';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_BASE });

/**
 * Every workspace call carries the session token. Reading it from storage on
 * each request (rather than caching it in a closure) means a fresh tab, a
 * second tab, or a sign-out in another tab all behave the same.
 */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_FREE = ['/auth/', '/health'];

/**
 * A 401 from a protected endpoint means the session is gone (expired, revoked,
 * or the server was pointed at a different AUTH_SECRET). Drop the local
 * session so the app cannot sit in a half-signed-in state pretending to work.
 */
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error?.config?.url || '';
    const isAuthFree = AUTH_FREE.some((p) => url.includes(p));
    if (error?.response?.status === 401 && !isAuthFree) {
      useSession.getState().handleUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Pulls the backend's message out of an axios error, so pages can show it. */
export const errorMessage = (e, fallback = 'Something went wrong.') =>
  e?.response?.data?.error || e?.message || fallback;

export const endpoints = {
  projects: '/projects', assets: '/assets', content: '/content',
};
