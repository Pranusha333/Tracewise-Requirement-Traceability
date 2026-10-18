import { ChevronDown, FileText, GitBranch, LayoutDashboard, Network, Settings2, Sparkles } from 'lucide-react';
import UserAvatar from './UserAvatar.jsx';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'requirements', label: 'Requirements', icon: FileText, badge: '128' },
  { id: 'traceability', label: 'Traceability Matrix', icon: Network },
  { id: 'impact', label: 'Impact Analysis', icon: GitBranch },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function Sidebar({ currentPage, user, workspace, requirementCount = 0 }) {
  const navigationItems = navigation.map((item) => item.id === 'requirements' ? { ...item, badge: requirementCount || '' } : item);
  const initials = (user?.name || 'User').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <aside className="sidebar">
      <a className="brand" href="#dashboard" aria-label="Tracewise home">
        <span className="brand-mark"><GitBranch size={21} strokeWidth={2.4} /></span>
        <span className="brand-name">tracewise<span>.</span></span>
      </a>

      <button className="workspace-switcher" type="button" onClick={() => { window.location.hash = 'settings'; }} title="Open workspace settings">
        <span className="workspace-icon">{(workspace?.name || 'W').slice(0, 1).toUpperCase()}</span>
        <span className="workspace-copy"><strong>{workspace?.name || 'Workspace'}</strong><small>{workspace?.description || 'Engineering project'}</small></span>
        <ChevronDown size={16} className="muted-icon" />
      </button>

      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigationItems.map(({ id, label, icon: Icon, badge, alert }) => (
          <a key={id} href={`#${id}`} title={label} aria-label={label} className={`nav-link${currentPage === id ? ' active' : ''}`} aria-current={currentPage === id ? 'page' : undefined}>
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {badge !== undefined && badge !== '' && <span className={`nav-badge${alert ? ' alert' : ''}${badge === 'NEW' ? ' nav-new' : ''}`}>{badge}</span>}
          </a>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-divider" />
        <div className="user-profile">
          <UserAvatar className="avatar avatar-user" fallbackClassName="avatar-initials" url={user?.avatarUrl} name={user?.name || initials} />
          <span className="user-copy"><strong>{user?.name}</strong><small>{user?.role === 'owner' ? 'Workspace owner' : 'Team member'}</small></span>
          <ChevronDown size={16} className="muted-icon" />
        </div>
      </div>
    </aside>
  );
}
