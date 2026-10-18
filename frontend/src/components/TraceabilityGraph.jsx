import { useState } from 'react';
import { Check, FileText, Link2, TestTube2 } from 'lucide-react';

export default function TraceabilityGraph({ requirements, relationships, testCases }) {
  const [selectedId, setSelectedId] = useState('');
  const selected = requirements.find((item) => item.requirementId === selectedId) || requirements[0];
  if (!selected) return <div className="trace-graph-empty">Add requirements to start building your traceability graph.</div>;

  const links = relationships.filter((item) => item.fromRequirementId === selected.requirementId || item.toRequirementId === selected.requirementId);
  const tests = testCases.filter((item) => item.requirementIds.includes(selected.requirementId));

  return <div className="trace-graph-layout">
    <section className="trace-graph-canvas" aria-label="Requirement relationship graph">
      <div className="trace-graph-requirements">
        {requirements.slice(0, 12).map((item) => <button type="button" key={item.requirementId} className={`trace-graph-card${item.requirementId === selected.requirementId ? ' selected' : ''}`} onClick={() => setSelectedId(item.requirementId)}><FileText size={18} /><span><strong>{item.requirementId}</strong><small title={item.title}>{item.title}</small></span></button>)}
      </div>
      <div className="trace-graph-connections"><h3>Selected requirement links</h3>{links.length ? links.map((link) => { const source = requirements.find((item) => item.requirementId === link.fromRequirementId); const target = requirements.find((item) => item.requirementId === link.toRequirementId); return <div className="trace-graph-connection" key={link._id}><button type="button" onClick={() => setSelectedId(link.fromRequirementId)}>{link.fromRequirementId}{source ? ` · ${source.title}` : ''}</button><i>{link.relationshipType}</i><button type="button" onClick={() => setSelectedId(link.toRequirementId)}>{link.toRequirementId}{target ? ` · ${target.title}` : ''}</button></div>; }) : <p>No requirement links yet.</p>}{tests.map((test) => <div className="trace-graph-connection test" key={test._id}><span>{selected.requirementId}</span><i>verified by</i><b>{test.testCaseId} · {test.title}</b></div>)}</div>
    </section>
    <aside className="trace-graph-inspector"><div className="trace-graph-inspector-title"><FileText size={23} /><div><strong>{selected.requirementId}</strong><span>{selected.title}</span></div></div><dl><div><dt>Type</dt><dd>{selected.type}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div></dl><p>{selected.description}</p><h3>Direct links ({links.length + tests.length})</h3>{links.map((link) => <div className="trace-graph-artifact" key={link._id}><Link2 size={14} />{link.fromRequirementId === selected.requirementId ? link.toRequirementId : link.fromRequirementId}<small>{link.relationshipType}</small></div>)}{tests.map((test) => <div className="trace-graph-artifact" key={test._id}><TestTube2 size={14} />{test.testCaseId}<small>Test case</small></div>)}{links.length + tests.length === 0 && <p className="trace-graph-no-links"><Check size={14} />No linked artifacts yet</p>}</aside>
  </div>;
}
