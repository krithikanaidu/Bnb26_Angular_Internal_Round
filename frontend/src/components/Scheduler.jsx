// Quick schedule form: platform + datetime + caption. Same props: { onSchedule }.
export default function Scheduler({ onSchedule, defaultCaption = '' }) {
  return (
    <form className="grid" style={{ gap: 8 }} onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      onSchedule?.({ platform: f.get('platform'), scheduledAt: f.get('scheduledAt') || null, caption: f.get('caption') });
      e.target.reset();
    }}>
      <div className="row">
        <select name="platform" aria-label="Platform">
          <option>tiktok</option><option>reels</option><option>shorts</option><option>x</option><option>linkedin</option>
        </select>
        <input name="scheduledAt" type="datetime-local" aria-label="Schedule time" />
      </div>
      <input name="caption" placeholder="caption (leave blank to post now as draft)" defaultValue={defaultCaption} />
      <button>Schedule</button>
    </form>
  );
}
