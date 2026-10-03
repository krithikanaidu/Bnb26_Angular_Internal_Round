// Schedule a publish job: platform + datetime + caption
export default function Scheduler({ onSchedule }) {
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.target); onSchedule?.({ platform: f.get('platform'), scheduledAt: f.get('scheduledAt'), caption: f.get('caption') }); }}>
      <select name="platform"><option>tiktok</option><option>reels</option><option>shorts</option><option>x</option></select>
      <input name="scheduledAt" type="datetime-local" />
      <input name="caption" placeholder="caption" />
      <button>Schedule</button>
    </form>
  );
}
