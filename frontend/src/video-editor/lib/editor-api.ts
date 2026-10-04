/**
 * Client for the editor's `/api/*` endpoints (transcribe, stock media, presign).
 *
 * Defaults to the same backend the shell app talks to (`VITE_API_URL`), so the
 * editor panels work without extra configuration; `VITE_EDITOR_API_URL` still
 * overrides for a dedicated editor service. Endpoints the backend has not
 * implemented return 404, which surfaces as EditorApiUnavailableError so
 * panels keep their "connect a backend" empty states.
 */
import { env } from "./vite-env";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — shell helper, untyped JS
import { getToken } from "../../lib/session";

export class EditorApiUnavailableError extends Error {
  constructor(path: string) {
    super(
      `Editor API unavailable: ${path} — the /api/* backend is not connected. ` +
        `Set VITE_EDITOR_API_URL or implement the endpoint on the backend.`,
    );
    this.name = "EditorApiUnavailableError";
  }
}

function apiBase(): string {
  const base = env("EDITOR_API_URL") || env("API_URL").replace(/\/api\/?$/, "") || "http://localhost:5000";
  return base.replace(/\/$/, "");
}

export async function editorApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new EditorApiUnavailableError(path);
  }
  if (!res.ok) {
    // Real backend responses carry an actionable message — pass it through.
    const detail = await res
      .json()
      .then((body) => body?.error)
      .catch(() => null);
    if (typeof detail === "string" && detail) {
      const err = new Error(detail) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    throw new EditorApiUnavailableError(path);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new EditorApiUnavailableError(path);
  }
}

/** True when the error means "no backend", as opposed to a real bug. */
export function isApiUnavailable(error: unknown): boolean {
  return error instanceof EditorApiUnavailableError;
}
