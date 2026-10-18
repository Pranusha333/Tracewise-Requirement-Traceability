import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Search, UserRound } from 'lucide-react';
import UserAvatar from './UserAvatar.jsx';

export default function Topbar({ pageTitle, searchTerm, onSearchChange, user, workspace, requirements = [], onLogout, onOpenSettings, onOpenRequirement }) {
  const [menu, setMenu] = useState('');
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const recent = [...requirements].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); document.querySelector('.search-button input')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!menu) return undefined;

    const menuRef = menu === 'notifications' ? notificationRef : profileRef;
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenu('');
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setMenu('');
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menu]);

  useEffect(() => {
    setMenu('');
  }, [pageTitle]);

  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>{pageTitle}</strong></div>
      <div className="topbar-actions">
        <label className="icon-button search-button"><Search size={18} /><input aria-label="Search requirements" placeholder="Search requirements..." value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} /><kbd>Ctrl K</kbd></label>
        {workspace?.preferences?.notifications !== false && <div ref={notificationRef} className="topbar-menu-wrap"><button className={`icon-button notification-button${menu === 'notifications' ? ' selected' : ''}`} type="button" aria-label="Recent requirement updates" aria-expanded={menu === 'notifications'} onClick={() => setMenu(menu === 'notifications' ? '' : 'notifications')}><Bell size={19} />{recent.length > 0 && <i />}</button>
          {menu === 'notifications' && <div className="topbar-popover notification-popover"><div className="topbar-popover-heading"><strong>Recent updates</strong><span>{recent.length}</span></div>{recent.length ? recent.map((item) => <button type="button" className="topbar-notification" key={item.id} onClick={() => { setMenu(''); onOpenRequirement?.(item.id); }}><span className="notification-dot" /><span><strong>{item.requirementId} · {item.title}</strong><small>{new Date(item.updatedAt).toLocaleString()}</small></span></button>) : <div className="topbar-popover-empty">No requirement updates yet.</div>}</div>}
        </div>}
        <div ref={profileRef} className="topbar-menu-wrap"><button className="topbar-user" type="button" aria-expanded={menu === 'profile'} onClick={() => setMenu(menu === 'profile' ? '' : 'profile')}><UserAvatar className="avatar avatar-user" fallbackClassName="avatar-initials" url={user?.avatarUrl} name={user?.name} /><ChevronDown size={15} className="muted-icon" /></button>
          {menu === 'profile' && <div className="topbar-popover profile-popover"><div className="profile-popover-user"><strong>{user?.name}</strong><small>{user?.email}</small></div><button type="button" onClick={() => { setMenu(''); onOpenSettings(); }}><UserRound size={15} />Profile and settings</button><button type="button" onClick={() => { setMenu(''); onLogout(); }}><LogOut size={15} />Sign out</button></div>}
        </div>
      </div>
    </header>
  );
}
