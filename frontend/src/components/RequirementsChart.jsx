const statuses = ['Draft', 'Approved', 'In Progress', 'Completed'];

function makeLine(values, maxValue) {
  return values.map((value, index) => {
    const x = 40 + (index / (values.length - 1)) * 690;
    const y = 162 - (value / maxValue) * 137;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

export default function RequirementsChart({ requirements = [] }) {
  const counts = statuses.map((status) => requirements.filter((item) => item.status === status).length);
  const highPriorityCounts = statuses.map((status) => requirements.filter((item) => item.status === status && ['Critical', 'High'].includes(item.priority)).length);
  const maxCount = Math.max(0, ...counts);
  // Use a data-derived scale with four distinct integer ticks, including for 0–2 items.
  const axisMax = Math.max(3, Math.ceil(maxCount / 3) * 3);
  const line = makeLine(counts, axisMax);
  const priorityLine = makeLine(highPriorityCounts, axisMax);
  const xPositions = [40, 270, 500, 730];
  const tickValues = [axisMax, axisMax * 2 / 3, axisMax / 3, 0];

  return (
    <section className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div><h2>Requirements overview</h2><p>Current requirements grouped by status.</p></div>
        <span className="chart-period-label">{requirements.length} total</span>
      </div>
      <div className="chart-legend"><span><i className="legend-current" />All requirements</span><span><i className="legend-previous" />High / critical</span></div>
      <div className="chart-scroll">
        <svg className="requirements-chart" viewBox="0 0 760 205" role="img" aria-label="Line chart of requirements and high priority requirements across draft, approved, in progress, and completed statuses" preserveAspectRatio="none">
          
          {[25, 65, 105, 145].map((y, index) => <g key={y}><line x1="40" x2="748" y1={y} y2={y} className="chart-grid-line" /><text x="9" y={y + 3} className="chart-y-label">{tickValues[index]}</text></g>)}
          <path d={`${line} L 730 162 L 40 162 Z`} fill="var(--color-primary)" fillOpacity=".08" />
          <path d={priorityLine} className="chart-line chart-line-previous" />
          <path d={line} className="chart-line chart-line-current" />
          {counts.map((value, index) => { const y = 162 - (value / axisMax) * 137; return <circle key={statuses[index]} cx={xPositions[index]} cy={y} r="3.5" className="chart-point" />; })}
          {statuses.map((status, index) => <text key={status} x={xPositions[index]} y="190" className="chart-x-label">{status}</text>)}
        </svg>
      </div>
    </section>
  );
}
