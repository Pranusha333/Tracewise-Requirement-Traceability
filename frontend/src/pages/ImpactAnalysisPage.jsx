import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, Check, Clock3, FileText, GitBranch, LoaderCircle, Network, Save, Search, ShieldCheck, TestTube2, Trash2, X } from 'lucide-react';
import { analyzeImpact, deleteImpactAnalysis, getImpactAnalyses, getImpactAnalysis, getImpactAnalysisCount, saveImpactAnalysis } from '../services/impactAnalysisService.js';
import './impactAnalysis.css';
import './impactActivity.css';
import './impactHistory.css';

function DependencyGraph({ graph }) {
  const levels = useMemo(() => {
    const byLevel = new Map();
    graph.nodes.forEach((node) => {
      const current = byLevel.get(node.level) || [];
      current.push(node);
      byLevel.set(node.level, current);
    });
    return byLevel;
  }, [graph]);
  const maxLevel = Math.max(0, ...levels.keys());
  const maxNodes = Math.max(1, ...[...levels.values()].map((nodes) => nodes.length));
  const nodeWidth = 174;
  const nodeHeight = 58;
  const columnGap = 88;
  const rowGap = 24;
  const width = Math.max(640, 34 + maxLevel * (nodeWidth + columnGap) + nodeWidth + 30);
  const height = 32 + maxNodes * (nodeHeight + rowGap);
  const positions = new Map();
  levels.forEach((nodes, level) => nodes.forEach((node, index) => positions.set(node.requirementId, {
    x: 24 + level * (nodeWidth + columnGap),
    y: 20 + index * (nodeHeight + rowGap),
  })));

  return (
    <div className="impact-graph-scroll" role="img" aria-label="Dependency graph showing direct and indirect impact paths">
      <svg className="impact-graph" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs><marker id="impact-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#a9a2d7" /></marker></defs>
        {graph.edges.map((edge, index) => {
          const from = positions.get(edge.fromRequirementId);
          const to = positions.get(edge.toRequirementId);
          if (!from || !to) return null;
          const startX = from.x + nodeWidth;
          const startY = from.y + nodeHeight / 2;
          const endX = to.x - 8;
          const endY = to.y + nodeHeight / 2;
          const middleX = (startX + endX) / 2;
          return <g key={`${edge.fromRequirementId}-${edge.toRequirementId}-${index}`}><path className="impact-graph-edge" d={`M${startX} ${startY} C${middleX} ${startY}, ${middleX} ${endY}, ${endX} ${endY}`} markerEnd="url(#impact-arrow)" /><text className="impact-edge-label" x={middleX} y={(startY + endY) / 2 - 5}>{edge.relationshipType}</text></g>;
        })}
        {graph.nodes.map((node) => {
          const position = positions.get(node.requirementId);
          const root = node.level === 0;
          return <g key={node.requirementId} transform={`translate(${position.x},${position.y})`}><title>{node.title}</title><rect className={`impact-node-rect${root ? ' root' : ''}`} width={nodeWidth} height={nodeHeight} rx="9" /><text className={`impact-node-id${root ? ' root' : ''}`} x="12" y="21">{node.requirementId}{root ? ' · CHANGED' : ''}</text><text className="impact-node-title" x="12" y="41">{node.title.length > 22 ? `${node.title.slice(0, 21)}…` : node.title}</text></g>;
        })}
      </svg>
    </div>
  );
}

function ImpactList({ title, subtitle, items, variant = 'requirement' }) {
  const testCases = variant === 'testCase';
  return <section className="panel impact-result-panel"><div className="impact-panel-heading"><span className={`impact-panel-icon ${testCases ? 'test' : 'direct'}`}>{testCases ? <TestTube2 size={17} /> : <GitBranch size={17} />}</span><div><h2>{title}</h2><p>{subtitle}</p></div><span className="impact-result-count">{items.length}</span></div>
    {items.length ? <div className="impact-result-list">{items.map((item) => <article className="impact-result-item" key={testCases ? item.testCaseId : item.requirementId}><div className="impact-item-main"><strong>{testCases ? item.testCaseId : item.requirementId}</strong><span>{item.title}</span></div>{testCases ? <div className="impact-item-meta"><span className="impact-tag test">Test case</span><small>Coverage: {item.requirementIds.join(', ')}</small></div> : <div className="impact-item-meta"><span className="impact-tag">{item.relationshipType}</span><small>Dependency depth: {item.level}</small></div>}<p>{item.reason}</p></article>)}</div> : <div className="impact-list-empty"><Check size={15} /><span>{testCases ? 'No test cases are linked to this requirement impact.' : 'No requirements were found in this impact group.'}</span></div>}
  </section>;
}

function ImpactActivityOverview({ history, totalCount, loading, error }) {
  const sorted = useMemo(() => [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [history]);
  const latest = sorted[0];
  return <section className="impact-overview" aria-label="Impact analysis overview">
    <div className="impact-overview-metrics">
      <article><span>Total saved analyses</span><strong>{loading || error ? '—' : totalCount}</strong><small>{error ? 'Could not load saved analyses' : 'Saved in this workspace'}</small></article>
      <article><span>Most recent analysis</span><strong className="impact-metric-date">{loading || error ? '—' : latest ? new Date(latest.createdAt).toLocaleDateString() : '—'}</strong><small>{error ? 'Could not load saved analyses' : latest ? `${latest.requirementId} · ${latest.requirementTitle}` : 'No saved analyses yet'}</small></article>
      <article><span>Affected requirements</span><strong>{loading || error ? '—' : latest?.counts.affectedRequirements ?? 0}</strong><small>{latest ? 'In the most recent analysis' : 'Latest analysis'}</small></article>
      <article><span>Affected test cases</span><strong>{loading || error ? '—' : latest?.counts.affectedTestCases ?? 0}</strong><small>{latest ? 'In the most recent analysis' : 'Latest analysis'}</small></article>
    </div>
    <section className="panel impact-recent-activity"><div className="impact-activity-heading"><div><h2>Recent analyses</h2><p>Latest saved impact reviews and their calculated counts</p></div></div>{error ? <p className="impact-recent-empty" role="alert">{error}</p> : loading ? <p className="impact-recent-empty" role="status">Loading saved analyses…</p> : sorted.length ? sorted.slice(0, 5).map((item) => <div className="impact-recent-row" key={item._id}><span className="impact-recent-dot" /><div><strong>{item.requirementId} · {item.requirementTitle}</strong><small>{item.counts.affectedRequirements} affected requirements · {item.counts.affectedTestCases} test cases · {new Date(item.createdAt).toLocaleDateString()}</small></div></div>) : <p className="impact-recent-empty">No saved analyses yet.</p>}</section>
  </section>;
}
export default function ImpactAnalysisPage({ requirements, loading: requirementsLoading, loadError: requirementsError, onRetry }) {
  const [requirementId, setRequirementId] = useState('');
  const [proposedChange, setProposedChange] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [working, setWorking] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  useEffect(() => {
    if (!requirementId && requirements.length) setRequirementId(requirements[0].requirementId || requirements[0].id);
  }, [requirementId, requirements]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    Promise.all([getImpactAnalyses(), getImpactAnalysisCount()]).then(([items, total]) => { if (active) { setHistory(items); setHistoryCount(total); } })
      .catch((error) => { if (active) setHistoryError(error.message); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (requirementsLoading || requirementsError) return;
    const savedDraft = sessionStorage.getItem('tracewise-impact-analysis-draft');
    if (!savedDraft) return;
    sessionStorage.removeItem('tracewise-impact-analysis-draft');
    try {
      const draft = JSON.parse(savedDraft);
      if (!requirements.some((item) => (item.requirementId || item.id) === draft.requirementId) || !draft.proposedChange) return;
      setRequirementId(draft.requirementId);
      setProposedChange(draft.proposedChange);
      setWorking(true);
      analyzeImpact(draft).then(setAnalysis).catch((error) => setPageError(error.message)).finally(() => setWorking(false));
    } catch {
      setPageError('The assistant change could not be opened in Impact Analysis. Please enter it again.');
    }
  }, [requirementsLoading, requirementsError, requirements]);

  const selectedRequirement = requirements.find((item) => (item.requirementId || item.id) === requirementId);

  function selectRequirement(value) {
    setRequirementId(value);
    setAnalysis(null);
    setProposedChange('');
    setPageError('');
  }

  async function runAnalysis(event) {
    event.preventDefault();
    setWorking(true); setPageError(''); setNotice('');
    try { setAnalysis(await analyzeImpact({ requirementId, proposedChange })); }
    catch (error) { setPageError(error.message); }
    finally { setWorking(false); }
  }

  async function saveAnalysis() {
    setWorking(true); setPageError(''); setNotice('');
    try {
      const saved = await saveImpactAnalysis({ requirementId: analysis.requirementId, proposedChange: analysis.proposedChange });
      setAnalysis(saved);
      setHistory((items) => [saved, ...items.filter((item) => item._id !== saved._id)].slice(0, 30));
      setHistoryCount((count) => count + 1);
      setNotice('Impact analysis saved. The original requirement was not changed.');
    } catch (error) { setPageError(error.message); }
    finally { setWorking(false); }
  }

  async function openSavedAnalysis(id) {
    setWorking(true); setPageError(''); setNotice('');
    try {
      const saved = await getImpactAnalysis(id);
      setRequirementId(saved.requirementId);
      setProposedChange(saved.proposedChange);
      setAnalysis(saved);
    } catch (error) { setPageError(error.message); }
    finally { setWorking(false); }
  }

  async function confirmDeleteSaved(id) {
    setWorking(true); setPageError('');
    try {
      await deleteImpactAnalysis(id);
      setHistory((items) => items.filter((item) => item._id !== id));
      setHistoryCount((count) => Math.max(0, count - 1));
      if (analysis?._id === id) setAnalysis(null);
      setDeleteCandidate(null); setNotice('Saved impact analysis deleted.');
    } catch (error) { setPageError(error.message); }
    finally { setWorking(false); }
  }

  const currentHistory = history.filter((item) => !requirementId || item.requirementId === requirementId);
  const isSaved = Boolean(analysis?._id);

  return <div className="dashboard-content feature-content impact-content">
    <div className="page-heading feature-heading impact-heading"><div><div className="eyebrow">PROJECT WORKSPACE</div><h1>Impact Analysis</h1><p>Explore which requirements and tests may be affected by a proposed change.</p></div><div className="impact-protection-note"><ShieldCheck size={16} /><span>Analysis never changes the original requirement.</span></div></div>

    <ImpactActivityOverview history={history} totalCount={historyCount} loading={historyLoading} error={historyError} />

    {requirementsLoading && <section className="panel impact-state" role="status"><span className="loading-spinner" /><strong>Loading requirements</strong><p>Getting requirements for impact analysis...</p></section>}
    {requirementsError && <section className="panel impact-state impact-error" role="alert"><AlertCircle size={19} /><strong>Requirements could not be loaded</strong><p>{requirementsError}</p><button className="button button-secondary" type="button" onClick={onRetry}>Try again</button></section>}
    {!requirementsLoading && !requirementsError && requirements.length === 0 && <section className="panel impact-state"><FileText size={20} /><strong>No requirements yet</strong><p>Add a requirement before running an impact analysis.</p><a className="button button-secondary" href="#requirements">Open requirements</a></section>}

    {!requirementsLoading && !requirementsError && requirements.length > 0 && <>
      <section className="panel impact-proposal-panel"><div className="impact-section-heading"><span className="impact-step">1</span><div><h2>Choose a requirement and propose a change</h2><p>Select a requirement to trace its dependency path and test coverage.</p></div></div>
        <form className="impact-proposal-form" onSubmit={runAnalysis}>
          <label className="form-field impact-requirement-select">Requirement to change<select required value={requirementId} onChange={(event) => selectRequirement(event.target.value)}><option value="">Select a requirement</option>{requirements.map((item) => <option key={item.requirementId || item.id} value={item.requirementId || item.id}>{item.requirementId || item.id} · {item.title}</option>)}</select></label>
          {selectedRequirement && <div className="impact-current-requirement"><div className="impact-current-heading"><FileText size={15} /><strong>{selectedRequirement.requirementId || selectedRequirement.id}</strong><span>Current requirement</span></div><h3>{selectedRequirement.title}</h3><p>{selectedRequirement.description}</p></div>}
          <label className="form-field">Proposed change<textarea required maxLength="4000" value={proposedChange} onChange={(event) => { setProposedChange(event.target.value); setAnalysis(null); setPageError(''); }} placeholder="Describe what you plan to change. This text is analyzed and saved separately from the original requirement." /></label>
          <div className="impact-form-footer"><span>{proposedChange.length}/4000 characters · Original requirement stays unchanged</span><button className="button button-primary" type="submit" disabled={working || !requirementId || !proposedChange.trim()}>{working ? <><LoaderCircle className="impact-button-spinner" size={15} /> Analyzing...</> : <><Search size={15} /> Analyze impact</>}</button></div>
        </form>
      </section>

      {pageError && <div className="impact-alert" role="alert"><AlertCircle size={16} />{pageError}<button type="button" onClick={() => setPageError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
      {notice && <div className="impact-success" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button></div>}

      {analysis && <section className="impact-results-section" aria-live="polite">
        <div className="impact-results-header"><div><div className="impact-section-heading"><span className="impact-step">2</span><div><h2>Impact results for {analysis.requirementId}</h2><p>Based on the current relationship graph and linked test cases.</p></div></div></div><div className="impact-summary-chips"><span><GitBranch size={14} />{analysis.counts.affectedRequirements} affected requirements</span><span><TestTube2 size={14} />{analysis.counts.affectedTestCases} test cases</span></div></div>
        <div className="impact-proposed-summary"><span>Proposed change</span><p>{analysis.proposedChange}</p></div>
        {analysis.counts.affectedRequirements === 0 && <div className="impact-no-links"><AlertCircle size={16} /><span>No linked requirements were found beyond the selected requirement. Add traceability relationships to build an impact path.</span></div>}
        <div className="impact-graph-panel panel"><div className="impact-panel-heading"><span className="impact-panel-icon graph"><Network size={17} /></span><div><h2>Dependency graph</h2><p>Each arrow follows an impact path from the changed requirement.</p></div></div><DependencyGraph graph={analysis.graph} /></div>
        <div className="impact-results-grid"><ImpactList title="Direct impacts" subtitle="Requirements one relationship away" items={analysis.directImpacts} /><ImpactList title="Indirect impacts" subtitle="Further requirements reached through dependencies" items={analysis.indirectImpacts} variant="indirect" /><ImpactList title="Affected test cases" subtitle="Tests linked to the changed or affected requirements" items={analysis.affectedTestCases} variant="testCase" /></div>
        <div className="impact-save-row"><span>{isSaved ? <><Check size={15} />Saved on {new Date(analysis.createdAt).toLocaleString()}</> : 'Save this result to review it later.'}</span><button className="button button-primary" type="button" onClick={saveAnalysis} disabled={working || isSaved}><Save size={15} />{isSaved ? 'Analysis saved' : 'Save analysis'}</button></div>
      </section>}

      <section className="panel impact-history-panel"><div className="impact-panel-heading"><span className="impact-panel-icon history"><Clock3 size={17} /></span><div><h2>Saved analyses</h2><p>Open a previous analysis to review its saved results.</p></div><span className="impact-result-count">{currentHistory.length}</span></div>
        {historyLoading ? <div className="impact-history-state"><span className="loading-spinner" /><span>Loading saved analyses...</span></div> : historyError ? <div className="impact-history-state impact-history-error" role="alert"><AlertCircle size={15} />{historyError}</div> : currentHistory.length ? <div className="impact-history-list">{currentHistory.map((item) => <div className="impact-history-entry" key={item._id}><button className={`impact-history-item${analysis?._id === item._id ? ' active' : ''}`} type="button" onClick={() => openSavedAnalysis(item._id)} disabled={working}><span className="impact-history-icon"><ArrowDownRight size={15} /></span><span className="impact-history-copy"><strong>{item.requirementId} · {item.requirementTitle}</strong><small>{item.proposedChange}</small></span><span className="impact-history-count">{item.counts.affectedRequirements} req · {item.counts.affectedTestCases} tests</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></button><button className="impact-history-delete" type="button" aria-label={`Delete saved analysis for ${item.requirementId}`} onClick={() => setDeleteCandidate(item)} disabled={working}><Trash2 size={14} /></button>{deleteCandidate?._id === item._id && <div className="impact-delete-confirm" role="alertdialog" aria-label="Confirm delete saved analysis"><span>Delete this saved analysis?</span><button type="button" className="button button-secondary" onClick={() => setDeleteCandidate(null)} disabled={working}>Cancel</button><button type="button" className="button button-danger" onClick={() => confirmDeleteSaved(item._id)} disabled={working}>{working ? 'Deleting…' : 'Delete'}</button></div>}</div>)}</div> : <div className="impact-history-empty"><Clock3 size={17} /><strong>No saved analyses yet</strong><span>Run and save an analysis to build your history.</span></div>}
      </section>
    </>}
  </div>;
}
