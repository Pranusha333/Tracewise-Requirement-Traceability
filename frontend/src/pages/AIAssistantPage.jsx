import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Bot, Check, CheckCircle2, Clock3, FileText, GitBranch, LoaderCircle, Pencil, Save, Search, ShieldAlert, Sparkles, TestTube2, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { analyzeAssistant, askAssistant, getAssistantAnalyses, getAssistantAnalysis, reviewRecommendation, saveAssistantAnalysis } from '../services/aiAssistantService.js';
import './aiAssistant.css';

function ImpactSnapshot({ analysis, onOpenRequirement, onViewDetailed }) {
  const groups = [
    { title: 'Direct', items: analysis.directImpacts, id: 'requirementId' },
    { title: 'Indirect', items: analysis.indirectImpacts, id: 'requirementId' },
    { title: 'Test cases', items: analysis.affectedTestCases, id: 'testCaseId' },
  ];
  return <section className="panel assistant-impact-snapshot">
    <div className="assistant-snapshot-heading"><div><span className="assistant-section-icon"><GitBranch size={16} /></span><div><h2>Traceability evidence</h2><p>Calculated from your current links and test records.</p></div></div><button type="button" className="assistant-full-impact-link" onClick={onViewDetailed}>Open full impact analysis <ArrowUpRight size={14} /></button></div>
    <div className="assistant-snapshot-groups">{groups.map((group) => <div className="assistant-snapshot-group" key={group.title}><div><strong>{group.title}</strong><span>{group.items.length}</span></div>{group.items.length ? <ul>{group.items.slice(0, 4).map((item) => <li key={item[group.id]}>{group.id === 'requirementId' ? <button type="button" onClick={() => onOpenRequirement(item.requirementId)}>{item.requirementId} · {item.title}</button> : <span>{item.testCaseId} · {item.title}</span>}</li>)}</ul> : <small>None found</small>}{group.items.length > 4 && <small>+{group.items.length - 4} more</small>}</div>)}</div>
  </section>;
}

function RecommendationCard({ recommendation, index, saved, disabled, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(recommendation.title);
  const [reason, setReason] = useState(recommendation.reason);
  const statusLabel = recommendation.status || 'pending';

  async function saveEdit() {
    await onUpdate(recommendation, index, { title, reason, status: 'edited' });
    setEditing(false);
  }

  return <article className="assistant-recommendation">
    <div className="assistant-recommendation-top"><span className={`assistant-recommendation-type ${recommendation.kind}`}>{recommendation.kind.replaceAll('_', ' ')}</span><span className={`assistant-review-status ${statusLabel}`}>{statusLabel}</span></div>
    {editing ? <div className="assistant-recommendation-edit"><label>Recommendation title<input maxLength="180" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Reason<textarea maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} /></label><div><button className="button button-secondary" type="button" onClick={() => { setTitle(recommendation.title); setReason(recommendation.reason); setEditing(false); }}>Cancel</button><button className="button button-primary" type="button" disabled={disabled || !title.trim() || !reason.trim()} onClick={saveEdit}>Save edit</button></div></div> : <><h3>{recommendation.title}</h3><p>{recommendation.reason}</p>{recommendation.referenceIds?.length > 0 && <div className="assistant-reference-list">{recommendation.referenceIds.map((id) => <span key={id}>{id}</span>)}</div>}</>}
    {!editing && <div className="assistant-recommendation-actions"><button type="button" onClick={() => { setTitle(recommendation.title); setReason(recommendation.reason); setEditing(true); }} disabled={disabled || statusLabel === 'rejected'}><Pencil size={13} />Edit</button><button type="button" onClick={() => onUpdate(recommendation, index, { status: 'accepted' })} disabled={disabled || statusLabel === 'accepted'}><ThumbsUp size={13} />Accept</button><button type="button" onClick={() => onUpdate(recommendation, index, { status: 'rejected' })} disabled={disabled || statusLabel === 'rejected'}><ThumbsDown size={13} />Reject</button>{!saved && <small>Save the analysis to persist your review.</small>}</div>}
  </article>;
}

export default function AIAssistantPage({ requirements, loading: requirementsLoading, loadError: requirementsError, onRetry, onOpenRequirement }) {
  const [question, setQuestion] = useState('');
  const [questionResult, setQuestionResult] = useState(null);
  const [asking, setAsking] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const [proposedChange, setProposedChange] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!requirementId && requirements.length) setRequirementId(requirements[0].requirementId || requirements[0].id);
  }, [requirementId, requirements]);

  useEffect(() => {
    let active = true;
    getAssistantAnalyses().then((items) => { if (active) setHistory(items); })
      .catch((loadError) => { if (active) setHistoryError(loadError.message); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = requirements.find((item) => (item.requirementId || item.id) === requirementId);
  const isSaved = Boolean(analysis?._id);

  async function submitQuestion(event) {
    event.preventDefault(); setAsking(true); setQuestionError(''); setQuestionResult(null);
    try { setQuestionResult(await askAssistant(question)); }
    catch (requestError) { setQuestionError(requestError.message); }
    finally { setAsking(false); }
  }

  function changeRequirement(value) {
    setRequirementId(value); setProposedChange(''); setAnalysis(null); setError(''); setNotice('');
  }

  async function runAnalysis(event) {
    event.preventDefault(); setWorking(true); setError(''); setNotice('');
    try { setAnalysis(await analyzeAssistant({ requirementId, proposedChange })); }
    catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  async function saveAnalysis() {
    setWorking(true); setError(''); setNotice('');
    try {
      const saved = await saveAssistantAnalysis({ requirementId: analysis.requirementId, proposedChange: analysis.proposedChange, assistant: analysis.assistant });
      setAnalysis(saved);
      setHistory((items) => [saved, ...items.filter((item) => item._id !== saved._id)].slice(0, 30));
      setNotice('Analysis saved. The original requirement was not changed.');
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  async function openSavedAnalysis(id) {
    setWorking(true); setError(''); setNotice('');
    try {
      const saved = await getAssistantAnalysis(id);
      setRequirementId(saved.requirementId); setProposedChange(saved.proposedChange); setAnalysis(saved);
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  function openDetailedImpact() {
    sessionStorage.setItem('tracewise-impact-analysis-draft', JSON.stringify({ requirementId: analysis.requirementId, proposedChange: analysis.proposedChange }));
    window.location.hash = 'impact';
  }

  async function updateReview(recommendation, index, changes) {
    if (working) return;
    setWorking(true); setError('');
    try {
      let updated;
      if (isSaved && recommendation._id) updated = await reviewRecommendation(analysis._id, recommendation._id, changes);
      else updated = { ...analysis, assistant: { ...analysis.assistant, recommendations: analysis.assistant.recommendations.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) } };
      setAnalysis(updated);
      if (updated._id) setHistory((items) => items.map((item) => item._id === updated._id ? updated : item));
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  const historyItems = history;

  return <div className="dashboard-content feature-content assistant-content">
    <div className="page-heading feature-heading assistant-heading"><div><div className="eyebrow">PROJECT WORKSPACE</div><h1>AI Assistant</h1><p>Ask questions about saved requirements, relationships, and test coverage.</p></div><div className="assistant-header-badge"><Sparkles size={15} />Evidence-grounded assistance</div></div>
    <div className="assistant-privacy-note"><ShieldAlert size={15} /><span>Without a provider key, answers use local matching against saved workspace records. If configured, the question and relevant requirement, relationship, and test records are sent to the provider. Credentials stay on the backend.</span></div>

    {requirementsLoading && <section className="panel assistant-state" role="status"><span className="loading-spinner" /><strong>Loading requirements</strong><p>Fetching the current project records...</p></section>}
    {requirementsError && <section className="panel assistant-state assistant-state-error" role="alert"><AlertCircle size={19} /><strong>Requirements could not be loaded</strong><p>{requirementsError}</p><button className="button button-secondary" type="button" onClick={onRetry}>Try again</button></section>}
    {!requirementsLoading && !requirementsError && requirements.length === 0 && <section className="panel assistant-state"><FileText size={21} /><strong>No requirements yet</strong><p>Add requirements before running a similarity or impact analysis.</p><a className="button button-secondary" href="#requirements">Open requirements</a></section>}

    {!requirementsLoading && !requirementsError && <section className="panel assistant-question-panel"><div className="assistant-question-heading"><span className="assistant-section-icon"><Bot size={17} /></span><div><h2>Ask about this workspace</h2><p>Get an answer with matching records and separate review suggestions.</p></div></div><form onSubmit={submitQuestion}><label className="form-field" htmlFor="assistant-question">Your question<textarea id="assistant-question" required maxLength="1200" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: Which requirements have no linked tests?" /></label><div className="assistant-question-footer"><span>{question.length}/1200 characters</span><button className="button button-primary" type="submit" disabled={asking || !question.trim()}>{asking ? <><LoaderCircle className="assistant-spinner" size={15} />Finding an answer…</> : <><Search size={15} />Ask assistant</>}</button></div></form>
      {questionError && <div className="assistant-message error" role="alert"><AlertCircle size={15} />{questionError}<button type="button" aria-label="Dismiss question error" onClick={() => setQuestionError('')}><X size={14} /></button></div>}
      {questionResult && <div className="assistant-question-result" aria-live="polite"><div className="assistant-question-answer"><div><strong>Answer</strong><span className={`assistant-source ${questionResult.source}`}><i />{questionResult.source === 'openai' ? `OpenAI · ${questionResult.model}` : 'Local records'}</span></div><p>{questionResult.answer}</p>{questionResult.source === 'local' && <small>{questionResult.fallbackReason}</small>}</div>{questionResult.suggestions.length > 0 && <div className="assistant-question-suggestions"><strong>Suggestions to review</strong><ul>{questionResult.suggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="assistant-question-evidence"><strong>Evidence from saved records</strong><div>{questionResult.evidence.requirements.map((item) => <button type="button" key={item.requirementId} onClick={() => onOpenRequirement(item.requirementId)}><b>{item.requirementId}</b><span>{item.title}</span><small>{item.status} · {item.priority} priority</small></button>)}{questionResult.evidence.relationships.map((item, index) => <span key={`${item.fromRequirementId}-${item.toRequirementId}-${index}`}>{item.fromRequirementId} {item.relationshipType.toLowerCase()} {item.toRequirementId}</span>)}{questionResult.evidence.testCases.map((item) => <span key={item.testCaseId}>{item.testCaseId} · {item.title}</span>)}{!questionResult.evidence.requirements.length && !questionResult.evidence.relationships.length && !questionResult.evidence.testCases.length && <span>No matching records were found.</span>}</div><small>Workspace totals: {questionResult.evidence.coverage.totalRequirements} requirements · {questionResult.evidence.coverage.linkedRequirements} with test coverage · {questionResult.evidence.coverage.totalTestCases} test cases</small></div></div>}
    </section>}

    {!requirementsLoading && !requirementsError && requirements.length > 0 && <>
      <section className="panel assistant-input-panel"><div className="assistant-step-heading"><span className="assistant-step-number">1</span><div><h2>Get AI review suggestions for a proposed change</h2><p>Compare requirement text, flag possible overlap, and suggest test reviews. Use Impact Analysis for the deterministic relationship graph.</p></div></div>
        <form className="assistant-form" onSubmit={runAnalysis}>
          <label className="form-field">Requirement<select required value={requirementId} onChange={(event) => changeRequirement(event.target.value)}><option value="">Select a requirement</option>{requirements.map((item) => <option key={item.requirementId || item.id} value={item.requirementId || item.id}>{item.requirementId || item.id} · {item.title}</option>)}</select></label>
          {selected && <article className="assistant-selected-requirement"><div className="assistant-selected-top"><span><FileText size={14} />{selected.requirementId || selected.id}</span><span>{selected.priority} priority</span><span>{selected.status}</span></div><h3>{selected.title}</h3><p>{selected.description}</p></article>}
          <label className="form-field">Proposed change<textarea required maxLength="4000" value={proposedChange} onChange={(event) => { setProposedChange(event.target.value); setAnalysis(null); setError(''); }} placeholder="Describe the behavior or requirement change to analyze." /></label>
          <div className="assistant-form-footer"><span>{proposedChange.length}/4000 characters · The existing requirement remains unchanged</span><button className="button button-primary" type="submit" disabled={working || !requirementId || !proposedChange.trim()}>{working ? <><LoaderCircle className="assistant-spinner" size={15} />Analyzing...</> : <><Sparkles size={15} />Analyze with assistant</>}</button></div>
        </form>
      </section>

      {error && <div className="assistant-message error" role="alert"><AlertCircle size={15} />{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
      {notice && <div className="assistant-message success" role="status"><CheckCircle2 size={15} />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14} /></button></div>}

      {analysis && <section className="assistant-results" aria-live="polite">
        <div className="assistant-results-heading"><div className="assistant-step-heading"><span className="assistant-step-number">2</span><div><h2>Analysis results</h2><p>{analysis.requirementId} · {analysis.requirementTitle} · {analysis.assistant.requirementPriority} priority · {analysis.assistant.requirementStatus}</p></div></div><div className={`assistant-source ${analysis.assistant.source}`}><span />{analysis.assistant.source === 'openai' ? `OpenAI · ${analysis.assistant.model}` : 'Local fallback'}</div></div>
        {analysis.assistant.source === 'fallback' && <div className="assistant-fallback-banner"><Bot size={15} /><span>{analysis.assistant.fallbackReason} Similarity uses {analysis.assistant.similarityMethod.toLowerCase()}.</span></div>}
        <article className="panel assistant-summary-card"><div className="assistant-summary-top"><span className="assistant-summary-icon"><Sparkles size={17} /></span><div><span>ANALYSIS SUMMARY</span><h2>{analysis.assistant.summary}</h2></div></div><p>{analysis.assistant.impactExplanation}</p><div className="assistant-summary-counts"><span><GitBranch size={14} />{analysis.counts.affectedRequirements} affected requirements</span><span><TestTube2 size={14} />{analysis.counts.affectedTestCases} affected test cases</span><span><Search size={14} />{analysis.assistant.similarRequirements.length} similar requirements</span></div></article>

        <section className="panel assistant-section"><div className="assistant-panel-heading"><span className="assistant-section-icon similar"><Search size={16} /></span><div><h2>Similar requirements</h2><p>{analysis.assistant.similarityMethod} · scored against the selected requirement and proposed change</p></div><span className="assistant-count">{analysis.assistant.similarRequirements.length}</span></div>
          {analysis.assistant.similarRequirements.length ? <div className="assistant-similar-grid">{analysis.assistant.similarRequirements.map((item) => <article className="assistant-similar-card" key={item.requirementId}><div className="assistant-similar-top"><strong>{item.requirementId}</strong><span>{item.score}% text similarity</span></div><h3>{item.title}</h3><p>{item.description}</p><small>{item.reason}</small><button type="button" onClick={() => onOpenRequirement(item.requirementId)}>Open requirement <ArrowUpRight size={13} /></button></article>)}</div> : <div className="assistant-empty-inline"><Check size={14} />No similar requirement text was found in the current project records.</div>}
        </section>

        <section className="panel assistant-section"><div className="assistant-panel-heading"><span className="assistant-section-icon risks"><ShieldAlert size={16} /></span><div><h2>Potential risks</h2><p>Evidence-based review points from the proposal and traceability records.</p></div><span className="assistant-count">{analysis.assistant.potentialRisks.length}</span></div>{analysis.assistant.potentialRisks.length ? <ul className="assistant-risk-list">{analysis.assistant.potentialRisks.map((risk, index) => <li key={`${index}-${risk}`}><AlertCircle size={14} />{risk}</li>)}</ul> : <div className="assistant-empty-inline"><Check size={14} />No additional risks were identified from the available records.</div>}</section>

        <section className="panel assistant-section"><div className="assistant-panel-heading"><span className="assistant-section-icon recommendations"><CheckCircle2 size={16} /></span><div><h2>Recommendations</h2><p>Review these suggestions before changing any requirement or test case.</p></div><span className="assistant-count">{analysis.assistant.recommendations.length}</span></div>{analysis.assistant.recommendations.length ? <div className="assistant-recommendations-grid">{analysis.assistant.recommendations.map((recommendation, index) => <RecommendationCard key={recommendation._id || `${recommendation.kind}-${index}`} recommendation={recommendation} index={index} saved={isSaved} disabled={working} onUpdate={updateReview} />)}</div> : <div className="assistant-empty-inline"><Check size={14} />No additional recommendations for this result.</div>}</section>

        <ImpactSnapshot analysis={analysis} onOpenRequirement={onOpenRequirement} onViewDetailed={openDetailedImpact} />

        <div className="assistant-save-bar"><span>{isSaved ? <><CheckCircle2 size={15} />Saved analysis · recommendation reviews are stored</> : 'Save this analysis and its recommendations to review them later.'}</span><button className="button button-primary" type="button" onClick={saveAnalysis} disabled={working || isSaved}><Save size={15} />{isSaved ? 'Analysis saved' : 'Save analysis'}</button></div>
      </section>}

      <section className="panel assistant-history"><div className="assistant-panel-heading"><span className="assistant-section-icon history"><Clock3 size={16} /></span><div><h2>Analysis history</h2><p>Saved assistant results, including their source and review status.</p></div><span className="assistant-count">{historyItems.length}</span></div>
        {historyLoading ? <div className="assistant-history-empty"><span className="loading-spinner" />Loading saved assistant analyses...</div> : historyError ? <div className="assistant-history-empty error" role="alert">{historyError}</div> : historyItems.length ? <div className="assistant-history-list">{historyItems.map((item) => <button key={item._id} className={`assistant-history-row${analysis?._id === item._id ? ' active' : ''}`} type="button" disabled={working} onClick={() => openSavedAnalysis(item._id)}><span className="assistant-history-mark"><Bot size={15} /></span><span className="assistant-history-copy"><strong>{item.requirementId} · {item.requirementTitle}</strong><small>{item.proposedChange}</small></span><span className={`assistant-history-source ${item.assistant.source}`}>{item.assistant.source === 'openai' ? 'OpenAI' : 'Fallback'}</span><span className="assistant-history-date">{new Date(item.createdAt).toLocaleDateString()}</span></button>)}</div> : <div className="assistant-history-empty"><Clock3 size={16} /><strong>No saved assistant analyses</strong><span>Analyze a change and save it to start your history.</span></div>}
      </section>
    </>}
  </div>;
}
