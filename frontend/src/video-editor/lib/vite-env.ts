// Vite-safe env accessor for the ported video editor.
// Reads from `import.meta.env` (VITE_* prefixed in Vite) with fallback to
// the original unprefixed server names, so both work when defined.

type EnvMap = Record<string, string | undefined>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv: EnvMap = ((import.meta as any)?.env ?? {}) as EnvMap;

export function env(key: string, fallback = ''): string {
  return viteEnv[key] ?? viteEnv[`VITE_${key}`] ?? fallback;
}
