import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FeaturePage from './pages/FeaturePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import { changePassword as changePasswordRequest, getSession, getWorkspace as getWorkspaceRequest, logout as logoutRequest, updateProfile as updateProfileRequest, updateWorkspace as updateWorkspaceRequest } from './services/authService.js';
import { createRequirement as createRequirementRequest, deleteRequirement as deleteRequirementRequest, getRequirements, updateRequirement as updateRequirementRequest } from './services/requirementService.js';

const pageTitles = { dashboard: 'Dashboard', requirements: 'Requirements', traceability: 'Traceability', impact: 'Impact Analysis', 'ai-assistant': 'AI Assistant', settings: 'Settings' };
const authPages = new Set(['login', 'register', 'verify-email', 'forgot-password', 'reset-password']);
const publicPages = new Set(['privacy', 'terms']);
function readPageFromHash() {
  const pageId = window.location.hash.slice(1).split('?')[0];
  return pageTitles[pageId] ? pageId : (authPages.has(pageId) || publicPages.has(pageId) ? pageId : 'dashboard');
}

export default function App() {
  const [currentPage, setCurrentPage] = useState(readPageFromHash);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsError, setRequirementsError] = useState('');
  const [openCreateRequest, setOpenCreateRequest] = useState(false);

  const loadRequirements = useCallback(async () => {
    if (!user) return;
    setRequirementsLoading(true); setRequirementsError('');
    try { setRequirements(await getRequirements()); }
    catch (error) { setRequirementsError(error.message); }
    finally { setRequirementsLoading(false); }
  }, [user]);

  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (!active) return;
      setUser(session.user); setWorkspace(session.workspace);
      if (authPages.has(readPageFromHash()) && readPageFromHash() !== 'reset-password') window.location.hash = 'dashboard';
    }).catch(() => {
      if (!active) return;
      setUser(null); setWorkspace(null);
      if (!authPages.has(readPageFromHash())) window.location.hash = 'login';
    }).finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user) loadRequirements();
    else { setRequirements([]); setRequirementsLoading(false); }
  }, [user, loadRequirements]);

  useEffect(() => {
    const syncPage = () => {
      const page = readPageFromHash(); setCurrentPage(page);
      if (!authLoading && !user && !authPages.has(page) && !publicPages.has(page)) window.location.hash = 'login';
      if (!authLoading && user && authPages.has(page) && page !== 'reset-password') window.location.hash = 'dashboard';
    };
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, [authLoading, user]);

  useEffect(() => {
    const root = document.documentElement;
    const preference = workspace?.preferences?.theme || 'light';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => { root.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference; };
    applyTheme();
    document.documentElement.classList.toggle('compact-mode', Boolean(workspace?.preferences?.compactMode));
    if (preference === 'system') media.addEventListener?.('change', applyTheme);
    return () => { if (preference === 'system') media.removeEventListener?.('change', applyTheme); };
  }, [workspace?.preferences?.theme, workspace?.preferences?.compactMode]);

  useEffect(() => {
    const handleUnauthorized = () => { setUser(null); setWorkspace(null); window.location.hash = 'login'; };
    window.addEventListener('tracewise:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('tracewise:unauthorized', handleUnauthorized);
  }, []);

  const handleAuthenticated = (session) => {
    setUser(session.user); setWorkspace(session.workspace); setRequirements([]); setRequirementsError('');
    window.location.hash = 'dashboard'; setCurrentPage('dashboard');
  };
  const handleLogout = async () => {
    try { await logoutRequest(); } catch { /* Local UI still closes when the network is unavailable. */ }
    setUser(null); setWorkspace(null); setRequirements([]); window.location.hash = 'login'; setCurrentPage('login');
  };
  const updateUser = async (values) => { const nextUser = await updateProfileRequest(values); setUser(nextUser); return nextUser; };
  const updateProject = async (values) => { const result = await updateWorkspaceRequest(values); setWorkspace((current) => ({ ...current, ...result.workspace })); return result.workspace; };
  const refreshWorkspace = async () => { const result = await getWorkspaceRequest(); setWorkspace(result.workspace); return result; };
  const changePassword = async (values) => changePasswordRequest(values);

  const createRequirement = useCallback(async (values) => {
    const created = await createRequirementRequest(values); setRequirements((items) => [created, ...items]); return created;
  }, []);
  const updateRequirement = useCallback(async (id, values) => {
    const updated = await updateRequirementRequest(id, values); setRequirements((items) => items.map((item) => item.id === id ? updated : item)); return updated;
  }, []);
  const deleteRequirement = useCallback(async (id) => { await deleteRequirementRequest(id); setRequirements((items) => items.filter((item) => item.id !== id)); }, []);
  const startNewRequirement = useCallback(() => { setOpenCreateRequest(true); if (window.location.hash !== '#requirements') window.location.hash = 'requirements'; }, []);
  const markCreateRequestHandled = useCallback(() => setOpenCreateRequest(false), []);
  const openRequirement = useCallback((requirementId) => { setSearchTerm(requirementId); if (window.location.hash !== '#requirements') window.location.hash = 'requirements'; }, []);

  if (publicPages.has(currentPage)) return <LegalPage page={currentPage} />;
  if (authLoading) return <div className="auth-loading"><LoaderCircle size={22} /><span>Loading your workspace...</span></div>;
  if (!user || authPages.has(currentPage)) return <AuthPage mode={authPages.has(currentPage) ? currentPage : 'login'} onAuthenticated={handleAuthenticated} onModeChange={(mode) => { window.location.hash = mode; setCurrentPage(mode); }} />;

  const approvedCount = requirements.filter((item) => item.status === 'Approved').length;
  const inProgressCount = requirements.filter((item) => item.status === 'In Progress').length;
  const completedCount = requirements.filter((item) => item.status === 'Completed').length;
  const dashboardStats = [
    { label: 'Total requirements', value: requirements.length, change: 'In your workspace', icon: 'FileText', tone: 'violet' },
    { label: 'Approved', value: approvedCount, change: 'Ready to implement', icon: 'CircleCheck', tone: 'blue' },
    { label: 'In progress', value: inProgressCount, change: 'Currently active', icon: 'Timer', tone: 'amber' },
    { label: 'Completed', value: completedCount, change: 'Marked complete', icon: 'CheckCheck', tone: 'rose' },
  ];

  return <div className="app-shell">
    <Sidebar currentPage={currentPage} user={user} workspace={workspace} requirementCount={requirements.length} />
    <main className="main-area">
      <Topbar pageTitle={pageTitles[currentPage]} searchTerm={searchTerm} onSearchChange={setSearchTerm} user={user} workspace={workspace} requirements={requirements} onLogout={handleLogout} onOpenSettings={() => { window.location.hash = 'settings'; }} onOpenRequirement={openRequirement} />
      {currentPage === 'dashboard'
        ? <DashboardPage searchTerm={searchTerm} requirements={requirements} stats={dashboardStats} loading={requirementsLoading} loadError={requirementsError} onRetry={loadRequirements} onNewRequirement={startNewRequirement} user={user} />
        : <FeaturePage pageId={currentPage} searchTerm={searchTerm} onSearchChange={setSearchTerm} requirements={requirements} loading={requirementsLoading} loadError={requirementsError} onRetry={loadRequirements} onCreateRequirement={createRequirement} onUpdateRequirement={updateRequirement} onDeleteRequirement={deleteRequirement} openCreateRequest={openCreateRequest} onCreateRequestHandled={markCreateRequestHandled} onOpenRequirement={openRequirement} user={user} workspace={workspace} onUpdateUser={updateUser} onUpdateWorkspace={updateProject} onRefreshWorkspace={refreshWorkspace} onChangePassword={changePassword} />}
    </main>
  </div>;
}
