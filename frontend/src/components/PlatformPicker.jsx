// Multi-select target platforms (tiktok, reels, shorts, x)
export default function PlatformPicker({ value = [], onChange }) {
  const all = ['tiktok', 'reels', 'shorts', 'x'];
  const toggle = (p) => onChange?.(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="row">
      {all.map((p) => (
        <button key={p} className={value.includes(p) ? 'pill' : ''} onClick={() => toggle(p)}>{p}</button>
      ))}
    </div>
  );
}
