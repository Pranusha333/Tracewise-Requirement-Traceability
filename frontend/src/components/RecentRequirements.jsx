import { ArrowUpRight, MoreHorizontal } from 'lucide-react';

function statusClass(status) {
  return status.toLowerCase().replace(' ', '-');
}

function formatDate(value) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp);
}

export default function RecentRequirements({ requirements = [], searchTerm = '', loading = false, error = '' }) {
  const query = searchTerm.trim().toLowerCase();
  const visibleRequirements = [...requirements]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .filter((item) => `${item.id} ${item.title} ${item.type} ${item.status}`.toLowerCase().includes(query))
    .slice(0, 4);
  return (
    <section className="panel requirements-panel">
      <div className="panel-heading">
        <div><h2>Recent requirements</h2><p>A quick look at what your team is working on.</p></div>
        <a className="text-link" href="#requirements">View all <ArrowUpRight size={15} /></a>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>REQUIREMENT</th><th>TYPE</th><th>STATUS</th><th>UPDATED</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {visibleRequirements.map((item) => (
              <tr key={item.id}>
                <td><div className="requirement-cell"><span className="requirement-symbol"><FileSymbol /></span><span><strong>{item.title}</strong><small>{item.id}</small></span></div></td>
                <td className="area-cell">{item.type}</td>
                <td><span className={`status-pill ${statusClass(item.status)}`}><i />{item.status}</span></td>
                <td className="updated-cell">{formatDate(item.updatedAt)}</td>
                <td><button type="button" className="row-more" aria-label={`More actions for ${item.id}`}><MoreHorizontal size={19} /></button></td>
              </tr>
            ))}
            {visibleRequirements.length === 0 && <tr><td colSpan="5" className="empty-table">{loading ? 'Loading requirements...' : error ? 'Requirements could not be loaded.' : requirements.length === 0 ? 'No requirements yet.' : 'No requirements match your search.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileSymbol() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5h5l3 3v8H4v-11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 2.8v3h2.8M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}
