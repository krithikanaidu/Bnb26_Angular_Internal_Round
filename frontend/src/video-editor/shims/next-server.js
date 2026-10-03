// Vite shim for `next/server` (server-only API routes are not bundled in Vite).
// Any import of this module on the client throws a clear error.
export class NextResponse {
  static json(body, init) {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    });
  }
}

export class NextRequest extends Request {}
