import { ArrowRight, Check, Sparkles } from 'lucide-react';
import RequirementsPage from './RequirementsPage.jsx';
import TraceabilityPage from './TraceabilityPage.jsx';
import ImpactAnalysisPage from './ImpactAnalysisPage.jsx';
import AIAssistantPage from './AIAssistantPage.jsx';
import SettingsPage from './SettingsPage.jsx';

const pageDetails = {
  requirements: { title: 'Requirements', intro: 'Capture and organize what your project needs to do.', icon: 'requirements', next: ['Create and edit requirements', 'Assign priority and status', 'Connect requirements to project artifacts'] },
  traceability: { title: 'Traceability', intro: 'See how requirements connect to design, development, and tests.', icon: 'traceability', next: ['Browse linked project artifacts', 'Spot requirements without coverage', 'Review trace links'] },
  impact: { title: 'Impact Analysis', intro: 'Understand which requirements and tests may be affected by a change.', icon: 'impact', next: ['Review pending change requests', 'Explore affected requirements', 'Summarize change impact'] },
  'ai-assistant': { title: 'AI Assistant', intro: 'Get a starting point for understanding requirement overlap and change impact.', icon: 'ai', next: ['Find similar requirements', 'Explain potential change impact', 'Review AI suggestions before applying'] },
  settings: { title: 'Settings', intro: 'Manage your project workspace preferences.', icon: 'settings', next: ['Project details', 'Team preferences', 'Workspace configuration'] },
};

export default function FeaturePage({ pageId, searchTerm, onSearchChange, requirements, loading, loadError, onRetry, onCreateRequirement, onUpdateRequirement, onDeleteRequirement, openCreateRequest, onCreateRequestHandled, onOpenRequirement, user, workspace, onUpdateUser, onUpdateWorkspace, onRefreshWorkspace, onChangePassword }) {
  const page = pageDetails[pageId] || pageDetails.requirements;

  if (pageId === 'requirements') {
    return <RequirementsPage requirements={requirements} searchTerm={searchTerm} onSearchChange={onSearchChange} loading={loading} loadError={loadError} onRetry={onRetry} onCreate={onCreateRequirement} onUpdate={onUpdateRequirement} onDelete={onDeleteRequirement} openCreateRequest={openCreateRequest} onCreateRequestHandled={onCreateRequestHandled} />;
  }

  if (pageId === 'traceability') {
    return <TraceabilityPage searchTerm={searchTerm} onSearchChange={onSearchChange} />;
  }

  if (pageId === 'impact') {
    return <ImpactAnalysisPage requirements={requirements} loading={loading} loadError={loadError} onRetry={onRetry} />;
  }

  if (pageId === 'ai-assistant') {
    return <AIAssistantPage requirements={requirements} loading={loading} loadError={loadError} onRetry={onRetry} onOpenRequirement={onOpenRequirement} />;
  }

  if (pageId === 'settings') {
    return <SettingsPage user={user} workspace={workspace} onUpdateUser={onUpdateUser} onUpdateWorkspace={onUpdateWorkspace} onRefreshWorkspace={onRefreshWorkspace} onChangePassword={onChangePassword} />;
  }

  return (
    <div className="dashboard-content feature-content">
      <div className="page-heading feature-heading"><div><div className="eyebrow">PROJECT WORKSPACE</div><h1>{page.title}</h1><p>{page.intro}</p></div></div>
      <section className="panel placeholder-panel">
          <div className={`placeholder-icon ${page.icon}`}><Sparkles size={23} /></div>
          <span className="coming-soon">STARTER PAGE</span>
          <h2>{page.title} workspace</h2>
          <p>This page is ready for the next project milestone. For now, here are the main tasks it will support.</p>
          <ul>{page.next.map((task) => <li key={task}><Check size={15} />{task}</li>)}</ul>
          <a href="#dashboard" className="text-link">Back to dashboard <ArrowRight size={15} /></a>
      </section>
    </div>
  );
}
