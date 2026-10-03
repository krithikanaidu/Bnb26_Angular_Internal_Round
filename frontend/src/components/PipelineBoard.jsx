// Kanban of projects grouped by workflow status (idea → published)
export default function PipelineBoard({ projects = [], statuses = ['idea', 'scripting', 'recording', 'editing', 'ready', 'scheduled', 'published'], onMove }) {
  return (
    <div className="kanban">
      {statuses.map((s) => (
        <div className="col" key={s}>
          <b>{s}</b>
          {projects.filter((p) => p.status === s).map((p) => (
            <div className="card" key={p.id}>
              {p.title}
              {onMove && <button onClick={() => onMove(p.id, s)}>↻</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
