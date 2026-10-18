import { CalendarDays, Plus } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import RequirementsChart from '../components/RequirementsChart.jsx';
import RecentRequirements from '../components/RecentRequirements.jsx';
import ActivityPanel from '../components/ActivityPanel.jsx';
import './dashboardPage.css';

export default function DashboardPage({ searchTerm, requirements, stats, loading, loadError, onRetry, onNewRequirement, user }) {
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div><div className="eyebrow">{today.toUpperCase()}</div><h1>Welcome, {user?.name?.split(/\s+/)[0] || 'there'} <span className="wave">&#10022;</span></h1><p>Here is what is happening with your project today.</p></div>
        <div className="heading-actions"><span className="button button-secondary dashboard-period"><CalendarDays size={16} />Live project data</span><button className="button button-primary" type="button" onClick={onNewRequirement}><Plus size={17} /> New requirement</button></div>
      </div>
      <section className="stats-grid" aria-label="Project overview">{stats.map((stat) => <StatCard key={stat.label} {...stat} value={loading || loadError ? '-' : stat.value} />)}</section>
      {loadError && <div className="dashboard-data-alert" role="alert"><span>{loadError}</span><button className="button button-secondary" type="button" onClick={onRetry}>Retry</button></div>}
      <RequirementsChart requirements={requirements} />
      <div className="content-grid"><RecentRequirements requirements={requirements} searchTerm={searchTerm} loading={loading} error={loadError} /><ActivityPanel requirements={requirements} loading={loading} error={loadError} /></div>
      <footer className="page-footer"><span><span className="footer-dot" /> All changes saved</span><span>Tracewise <b>-</b> Project workspace</span></footer>
    </div>
  );
}
