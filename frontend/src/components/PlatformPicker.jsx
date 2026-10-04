// Multi-select target platforms. Same props as before: { value, onChange }.
// Swatches are theme tokens now — the old inline hex/var pairs were tuned for
// the pre-port palette and drifted out of contrast in dark mode.
const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok', color: 'var(--color-ink)' },
  { key: 'reels', label: 'Reels', color: 'var(--color-hot-pink)' },
  { key: 'shorts', label: 'Shorts', color: 'var(--color-status-red)' },
  { key: 'x', label: 'X', color: 'var(--color-folder-blue)' },
  { key: 'linkedin', label: 'LinkedIn', color: 'var(--color-olive)' },
];

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export default function PlatformPicker({ value = [], onChange }) {
  const toggle = (p) => onChange?.(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="bb-row" role="group" aria-label="Target platforms">
      {PLATFORMS.map((p) => {
        const on = value.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => toggle(p.key)}
            aria-pressed={on}
            title={p.label}
            className={`pill-btn ${on ? 'active' : ''}`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: p.color }} aria-hidden />
            {p.label}
            {on && <span aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
