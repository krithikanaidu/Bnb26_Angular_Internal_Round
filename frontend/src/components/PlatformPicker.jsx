// Multi-select target platforms. Same props as before: { value, onChange }.
const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok', color: 'var(--ink)', text: 'var(--paper)' },
  { key: 'reels', label: 'Reels', color: 'var(--pink)' },
  { key: 'shorts', label: 'Shorts', color: 'var(--coral)', text: 'var(--paper)' },
  { key: 'x', label: 'X', color: 'var(--sky)' },
  { key: 'linkedin', label: 'LinkedIn', color: 'var(--olive)' },
];

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export default function PlatformPicker({ value = [], onChange }) {
  const toggle = (p) => onChange?.(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="row" role="group" aria-label="Target platforms">
      {PLATFORMS.map((p) => {
        const on = value.includes(p.key);
        return (
          <button key={p.key} type="button" onClick={() => toggle(p.key)}
            aria-pressed={on}
            style={on ? { background: p.color, color: p.text || 'var(--ink)' } : {}}
            title={p.label}>
            {on ? '✓ ' : ''}{p.label}
          </button>
        );
      })}
    </div>
  );
}
