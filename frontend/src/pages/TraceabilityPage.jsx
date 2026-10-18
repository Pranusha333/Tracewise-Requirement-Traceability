import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CircleHelp, FileText, Link2, Pencil, Plus, RefreshCw, Search, Trash2, Unlink, X } from 'lucide-react';
import { requirementPriorities, requirementTypes } from '../data/requirements.js';
import { getTraceabilityData, removeRelationship, removeTestCase, saveRelationship, saveTestCase, unlinkTestCaseRequirement } from '../services/traceabilityService.js';
import './traceability.css';
import TraceabilityGraph from '../components/TraceabilityGraph.jsx';

const relationshipTypes = ['Depends On', 'Related To', 'Implements'];

function TraceabilityDialog({ kind, target, requirements, onClose, onSave, saving, error }) {
  const relationship = kind === 'relationship';
  const [fromRequirementId, setFrom] = useState(target?.fromRequirementId || '');
  const [toRequirementId, setTo] = useState(target?.toRequirementId || '');
  const [relationshipType, setType] = useState(target?.relationshipType || relationshipTypes[0]);
  const [title, setTitle] = useState(target?.title || '');
  const [description, setDescription] = useState(target?.description || '');
  const [requirementIds, setRequirementIds] = useState(target?.requirementIds || []);

  function toggleRequirement(id) {
    setRequirementIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submit(event) {
    event.preventDefault();
    onSave(relationship
      ? { fromRequirementId, toRequirementId, relationshipType }
      : { title, description, requirementIds });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="dialog-card trace-dialog" role="dialog" aria-modal="true" aria-labelledby="trace-dialog-title">
        <div className="dialog-heading"><div><span className="dialog-kicker">TRACEABILITY</span><h2 id="trace-dialog-title">{relationship ? `${target ? 'Edit' : 'Link'} requirements` : `${target ? 'Edit' : 'Add'} test case`}</h2><p>{relationship ? 'Choose the two requirements and describe how they connect.' : 'Add a test case and select every requirement it verifies.'}</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></div>
        <form onSubmit={submit}>
          {relationship ? <>
            <label className="form-field">Source requirement<select required value={fromRequirementId} onChange={(event) => setFrom(event.target.value)}><option value="">Select a requirement</option>{requirements.map((item) => <option key={item.requirementId} value={item.requirementId}>{item.requirementId} · {item.title}</option>)}</select></label>
            <label className="form-field">Related requirement<select required value={toRequirementId} onChange={(event) => setTo(event.target.value)}><option value="">Select a requirement</option>{requirements.map((item) => <option key={item.requirementId} value={item.requirementId} disabled={item.requirementId === fromRequirementId}>{item.requirementId} · {item.title}</option>)}</select></label>
            <label className="form-field">Relationship type<select value={relationshipType} onChange={(event) => setType(event.target.value)}>{relationshipTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          </> : <>
            <label className="form-field">Test case title<input autoFocus maxLength="160" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Verify sign-in with valid credentials" /></label>
            <label className="form-field">Description<textarea maxLength="4000" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the checks this test performs." /></label>
            <fieldset className="trace-requirement-picker"><legend>Linked requirements <span className="required-mark">*</span></legend><div className="trace-requirement-options">{requirements.map((item) => <label key={item.requirementId}><input type="checkbox" checked={requirementIds.includes(item.requirementId)} onChange={() => toggleRequirement(item.requirementId)} /><span><strong>{item.requirementId}</strong>{item.title}</span></label>)}</div>{requirements.length === 0 && <p>Create a requirement before adding a test case.</p>}</fieldset>
          </>}
          {error && <p className="form-submit-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || (!relationship && requirements.length === 0)}>{saving ? 'Saving...' : target ? 'Save changes' : relationship ? 'Create link' : 'Add test case'}</button></div>
        </form>
      </section>
    </div>
  );
}

function ConfirmRemoval({ item, onCancel, onConfirm, removing, error }) {
  const testCase = item.kind === 'testCase';
  const testCaseLink = item.kind === 'testCaseRequirement';
  const title = testCase ? 'Delete this test case?' : testCaseLink ? 'Unlink this requirement?' : 'Remove this relationship?';
  const description = testCase
    ? <><strong>{item.value.testCaseId}</strong> · {item.value.title} will be deleted.</>
    : testCaseLink
      ? <>Remove the link between <strong>{item.value.requirementId}</strong> and test case <strong>{item.value.testCase.testCaseId}</strong>? The test case will stay in the workspace.</>
      : <>The link between <strong>{item.value.fromRequirementId}</strong> and <strong>{item.value.toRequirementId}</strong> will be removed.</>;
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !removing) onCancel(); }}><section className="dialog-card confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="trace-remove-title"><span className="confirm-icon"><AlertCircle size={21} /></span><h2 id="trace-remove-title">{title}</h2><p>{description}</p>{error && <p className="form-submit-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onCancel} disabled={removing}>Cancel</button><button className="button button-danger" type="button" onClick={onConfirm} disabled={removing}>{removing ? 'Removing...' : testCase ? 'Delete test case' : testCaseLink ? 'Unlink requirement' : 'Remove link'}</button></div></section></div>;
}

export default function TraceabilityPage({ searchTerm, onSearchChange }) {
  const [data, setData] = useState({ requirements: [], relationships: [], testCases: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dialog, setDialog] = useState(null);
  const [viewMode, setViewMode] = useState('graph');
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setData(await getTraceabilityData()); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3200); return () => window.clearTimeout(timer); }, [notice]);

  const filteredRequirements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.requirements.filter((item) => (!query || `${item.requirementId} ${item.title}`.toLowerCase().includes(query)) && (!typeFilter || item.type === typeFilter) && (!priorityFilter || item.priority === priorityFilter));
  }, [data.requirements, searchTerm, typeFilter, priorityFilter]);

  async function submitDialog(values) {
    setSaving(true); setActionError('');
    try {
      if (dialog.kind === 'relationship') await saveRelationship(values, dialog.target?._id);
      else await saveTestCase(values, dialog.target?._id);
      setDialog(null);
      setNotice(dialog.target ? 'Traceability data was updated.' : dialog.kind === 'relationship' ? 'Requirement link was created.' : 'Test case was created.');
      await refresh();
    } catch (error) { setActionError(error.message); }
    finally { setSaving(false); }
  }

  async function confirmRemove() {
    setRemoving(true); setActionError('');
    try {
      if (confirmation.kind === 'relationship') await removeRelationship(confirmation.value._id);
      else if (confirmation.kind === 'testCaseRequirement') await unlinkTestCaseRequirement(confirmation.value.testCase._id, confirmation.value.requirementId);
      else await removeTestCase(confirmation.value._id);
      setConfirmation(null); setNotice(confirmation.kind === 'relationship' ? 'Requirement link was removed.' : confirmation.kind === 'testCaseRequirement' ? 'Requirement unlinked. The test case was kept.' : 'Test case was deleted.');
      await refresh();
    } catch (error) { setActionError(error.message); }
    finally { setRemoving(false); }
  }

  const testCoveredCount = data.requirements.filter((item) => data.testCases.some((testCase) => testCase.requirementIds.includes(item.requirementId))).length;
  const testCoverage = data.requirements.length ? Math.round((testCoveredCount / data.requirements.length) * 100) : null;

  return (
    <div className="dashboard-content feature-content traceability-content">
      <div className="page-heading feature-heading traceability-heading"><div><div className="eyebrow">PROJECT WORKSPACE</div><h1>Traceability Matrix</h1><p>Connect requirements to related work and verify test coverage.</p></div><div className="trace-heading-actions"><button className="button button-secondary" type="button" onClick={refresh} disabled={loading}><RefreshCw size={14} /> Refresh</button><button className="button button-secondary" type="button" onClick={() => { setActionError(''); setDialog({ kind: 'relationship', target: null }); }} disabled={data.requirements.length < 2}><Link2 size={15} /> Link requirements</button><button className="button button-primary" type="button" onClick={() => { setActionError(''); setDialog({ kind: 'testCase', target: null }); }} disabled={data.requirements.length === 0}><Plus size={15} /> Add test case</button></div></div>

      <div className="trace-summary" aria-label="Traceability summary"><article><span className="trace-summary-icon violet"><FileText size={17} /></span><div><strong>{loading || loadError ? '-' : data.requirements.length}</strong><span>Requirements</span></div></article><article><span className="trace-summary-icon green"><Link2 size={17} /></span><div><strong>{loading || loadError ? '-' : data.relationships.length}</strong><span>Relationship links</span></div></article><article><span className="trace-summary-icon amber"><Check size={17} /></span><div><strong>{loading || loadError ? '-' : data.testCases.length}</strong><span>Test cases</span></div></article><article><span className="trace-summary-icon green"><Unlink size={17} /></span><div><strong>{loading || loadError || testCoverage === null ? '-' : `${testCoverage}%`}</strong><span>Test coverage</span></div></article></div>

      {actionError && !dialog && !confirmation && <div className="trace-alert" role="alert"><AlertCircle size={16} />{actionError}<button type="button" onClick={() => setActionError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
      {loadError && <section className="panel trace-state trace-state-error" role="alert"><span className="empty-icon"><AlertCircle size={19} /></span><strong>Traceability data could not be loaded</strong><p>{loadError}</p><button className="button button-secondary" type="button" onClick={refresh}>Try again</button></section>}
      {loading && <section className="panel trace-state" role="status"><span className="loading-spinner" /><strong>Loading traceability data</strong><p>Connecting requirements, links, and tests...</p></section>}

      {!loading && !loadError && <section className="panel trace-matrix-panel">
        <div className="trace-toolbar"><div><h2>Requirement coverage</h2><p>Missing links and test coverage are highlighted for review.</p><div className="trace-view-switch" role="tablist" aria-label="Traceability view"><button type="button" role="tab" aria-selected={viewMode === 'graph'} className={viewMode === 'graph' ? 'active' : ''} onClick={() => setViewMode('graph')}>Graph</button><button type="button" role="tab" aria-selected={viewMode === 'matrix'} className={viewMode === 'matrix' ? 'active' : ''} onClick={() => setViewMode('matrix')}>Matrix</button></div></div><div className="trace-filters"><label className="trace-search"><Search size={15} /><input aria-label="Search by requirement ID or title" placeholder="Search ID or title" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} /></label><select aria-label="Filter by requirement type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{requirementTypes.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">All priorities</option>{requirementPriorities.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        <div className="trace-legend"><span><i className="legend-linked" />Linked</span><span><i className="legend-missing" />Missing coverage</span></div>
        {viewMode === 'graph' && <TraceabilityGraph requirements={filteredRequirements} relationships={data.relationships} testCases={data.testCases} />}
        {viewMode === 'matrix' && <>
        <div className="table-wrap trace-table-wrap"><table className="trace-table"><thead><tr><th>REQUIREMENT</th><th>TYPE / PRIORITY</th><th>REQUIREMENT LINKS</th><th>TEST CASES</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {filteredRequirements.map((requirement) => {
            const related = data.relationships.filter((link) => link.fromRequirementId === requirement.requirementId || link.toRequirementId === requirement.requirementId);
            const linkedTests = data.testCases.filter((testCase) => testCase.requirementIds.includes(requirement.requirementId));
            const hasRelationship = related.length > 0;
            const hasTestCoverage = linkedTests.length > 0;
            const hasTraceability = hasRelationship || hasTestCoverage;
            const rowClasses = hasTraceability ? undefined : 'matrix-row-unlinked';
            return <tr key={requirement.requirementId} className={rowClasses}>
              <td className="matrix-requirement"><strong>{requirement.requirementId}</strong><span>{requirement.title}</span></td>
              <td><div className="matrix-meta"><span className="type-pill">{requirement.type}</span><span className={`req-priority ${requirement.priority.toLowerCase()}`}><i />{requirement.priority}</span></div></td>
              <td><div className="matrix-artifacts">{hasRelationship ? related.map((link) => { const outgoing = link.fromRequirementId === requirement.requirementId; const undirected = link.relationshipType === 'Related To'; const counterpart = outgoing ? link.toRequirementId : link.fromRequirementId; return <div className="matrix-artifact relationship-artifact" key={link._id}><span className="artifact-direction" title={undirected ? 'Related requirements' : outgoing ? 'Outgoing link' : 'Incoming link'}>{undirected ? '\u2194' : outgoing ? '\u2192' : '\u2190'}</span><span className="artifact-copy"><strong>{counterpart}</strong><small>{link.relationshipType}</small></span><button type="button" aria-label={`Edit relationship ${link.fromRequirementId} to ${link.toRequirementId}`} onClick={() => { setActionError(''); setDialog({ kind: 'relationship', target: link }); }}><Pencil size={13} /></button><button className="artifact-remove" type="button" aria-label={`Remove relationship ${link.fromRequirementId} to ${link.toRequirementId}`} onClick={() => { setActionError(''); setConfirmation({ kind: 'relationship', value: link }); }}><Trash2 size={13} /></button></div>; }) : <span className="coverage-missing"><CircleHelp size={14} />No requirement links</span>}</div></td>
              <td><div className="matrix-artifacts">{linkedTests.length ? linkedTests.map((item) => <div className="matrix-artifact testcase-artifact" key={item._id}><span className="artifact-test-icon"><Check size={13} /></span><span className="artifact-copy"><strong>{item.testCaseId} · {item.title}</strong><small>{item.description}</small></span><button type="button" aria-label={`Edit test case ${item.testCaseId}`} title="Edit test case" onClick={() => { setActionError(''); setDialog({ kind: 'testCase', target: item }); }}><Pencil size={13} /></button><button className="artifact-remove" type="button" aria-label={`Unlink ${item.testCaseId} from ${requirement.requirementId}`} title="Unlink from this requirement" onClick={() => { setActionError(''); setConfirmation({ kind: 'testCaseRequirement', value: { testCase: item, requirementId: requirement.requirementId } }); }}><Unlink size={13} /></button><button className="artifact-remove" type="button" aria-label={`Delete test case ${item.testCaseId}`} title="Delete test case" onClick={() => { setActionError(''); setConfirmation({ kind: 'testCase', value: item }); }}><Trash2 size={13} /></button></div>) : <span className="coverage-missing"><CircleHelp size={14} />No linked test cases</span>}</div></td>
              <td className="matrix-status-cell"><span className={`matrix-status${hasTraceability ? ' is-linked' : ' is-missing'}`}>{hasTraceability ? 'Linked' : 'Unlinked'}</span></td>
            </tr>;
          })}
          {filteredRequirements.length === 0 && <tr><td colSpan="5"><div className="requirements-empty"><span className="empty-icon"><Search size={19} /></span><strong>{data.requirements.length ? 'No matching requirements' : 'No requirements yet'}</strong><p>{data.requirements.length ? 'Try changing the search or filters.' : 'Add requirements first, then create links and test coverage.'}</p></div></td></tr>}
        </tbody></table></div>
        <div className="management-footer"><span>Showing {filteredRequirements.length} of {data.requirements.length} requirements</span><span>{data.relationships.length} requirement links <small>·</small> {data.testCases.length} test cases</span></div>
        </>}
      </section>}

      {notice && <div className="success-toast" role="status"><Check size={17} /><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {dialog && <TraceabilityDialog kind={dialog.kind} target={dialog.target} requirements={data.requirements} onClose={() => setDialog(null)} onSave={submitDialog} saving={saving} error={actionError} />}
      {confirmation && <ConfirmRemoval item={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmRemove} removing={removing} error={actionError} />}
    </div>
  );
}
