import { ArrowUpRight } from 'lucide-react';

function relativeTime(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 'Time unavailable';
  const ageInMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (ageInMinutes < 1) return 'Just now';
  if (ageInMinutes < 60) return `${ageInMinutes}m ago`;
  const ageInHours = Math.floor(ageInMinutes / 60);
  if (ageInHours < 24) return `${ageInHours}h ago`;
  const ageInDays = Math.floor(ageInHours / 24);
  if (ageInDays === 1) return 'Yesterday';
  if (ageInDays < 7) return `${ageInDays}d ago`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp);
}

export default function ActivityPanel({ requirements = [], loading = false, error = '' }) {
  const activityItems = [...requirements]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 3).map((item, index) => {
      const createdAt = new Date(item.createdAt).getTime();
      const updatedAt = new Date(item.updatedAt).getTime();
      const wasUpdated = Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt > createdAt;
      return {
        id: item.id,
        color: ['lavender', 'peach', 'mint'][index % 3],
        title: wasUpdated ? 'A requirement was updated' : 'A requirement was added',
        detail: `${item.id} - ${item.title}`,
        time: relativeTime(item.updatedAt),
      };
    });

  return (
    <section className="panel activity-panel">
      <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your team.</p></div><button className="plain-icon" type="button" aria-label="Open activity"><ArrowUpRight size={17} /></button></div>
      <div className="activity-list">
        {activityItems.map((item, index) => (
          <div className="activity-item" key={item.id}>
            <div className="activity-rail"><span className={`avatar avatar-${item.color}`}>RQ</span>{index < activityItems.length - 1 && <span className="rail-line" />}</div>
            <div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span></div>
            <time>{item.time}</time>
          </div>
        ))}
        {activityItems.length === 0 && <p className="activity-empty">{loading ? 'Loading recent updates...' : error ? 'Updates are unavailable until the database reconnects.' : 'New and updated requirements will appear here.'}</p>}
      </div>
      <a href="#activity" className="activity-footer">See all activity <ArrowUpRight size={15} /></a>
    </section>
  );
}
