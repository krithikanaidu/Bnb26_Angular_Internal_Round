/**
 * Client for the editor's `/api/*` endpoints.
 *
 * The original Next.js project served these routes itself (uploads, transcribe,
 * stock music/SFX, Pexels). This Vite port has no `/api/*` server yet, so every
 * call currently 404s. This helper fails fast with a typed error (instead of
 * an HTML-as-JSON parse crash + console spam) so panels can render a friendly
 * "connect a backend" empty state.
 *
 * Once the Express backend implements these endpoints, no panel code changes
 * are needed — set `VITE_EDITOR_API_URL` (e.g. `http://localhost:5000`) and the
 * calls will be routed there.
 */
import { env } from "./vite-env";

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
  const base = env("EDITOR_API_URL");
  return base ? base.replace(/\/$/, "") : "";
}

export async function editorApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new EditorApiUnavailableError(path);
  }
  if (!res.ok) {
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
