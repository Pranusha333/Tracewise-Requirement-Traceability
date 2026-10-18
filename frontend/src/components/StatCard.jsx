import { FileText, CircleCheck, Timer, CheckCheck, ArrowUpRight } from 'lucide-react';

const icons = { FileText, CircleCheck, Timer, CheckCheck };

export default function StatCard({ label, value, change, icon, tone }) {
  const Icon = icons[icon];
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></span><button type="button" className="card-more" aria-label={`${label} details`}><ArrowUpRight size={17} /></button></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-change">{change}</div>
    </article>
  );
}
