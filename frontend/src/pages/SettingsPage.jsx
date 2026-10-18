import { useEffect, useState } from 'react';
import { Bell, Check, Clipboard, KeyRound, LoaderCircle, LockKeyhole, RefreshCw, Save, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { getWorkspace, rotateInviteCode } from '../services/authService.js';
import UserAvatar from '../components/UserAvatar.jsx';
import './settings.css';

function SettingsNotice({ notice, error }) {
  if (!notice && !error) return null;
  return <div className={`settings-notice ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || notice}</div>;
}

export default function SettingsPage({ user, workspace, onUpdateUser, onUpdateWorkspace, onRefreshWorkspace, onChangePassword }) {
  const [team, setTeam] = useState([]);
  const [profile, setProfile] = useState({ name: user.name, email: user.email, avatarUrl: user.avatarUrl || '', currentPassword: '' });
  const [project, setProject] = useState({ name: workspace?.name || '', description: workspace?.description || '' });
  const [preferences, setPreferences] = useState({ theme: workspace?.preferences?.theme || 'light', notifications: workspace?.preferences?.notifications ?? true, compactMode: workspace?.preferences?.compactMode ?? false });
  const [aiModel, setAiModel] = useState(workspace?.aiModel || 'gpt-6-astra');
  const [aiApiKey, setAiApiKey] = useState('');
  const [clearAiApiKey, setClearAiApiKey] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getWorkspace().then((result) => { if (active) setTeam(result.members); }).catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setProfile({ name: user.name, email: user.email, avatarUrl: user.avatarUrl || '', currentPassword: '' });
    setProject({ name: workspace?.name || '', description: workspace?.description || '' });
    setPreferences({ theme: workspace?.preferences?.theme || 'light', notifications: workspace?.preferences?.notifications ?? true, compactMode: workspace?.preferences?.compactMode ?? false });
    setAiModel(workspace?.aiModel || 'gpt-6-astra');
  }, [user, workspace]);

  async function run(key, action, message) {
    setBusy(key); setError(''); setNotice('');
    try { await action(); setNotice(message); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(''); }
  }
  function saveProfile(event) { event.preventDefault(); if (profile.avatarUrl) { try { const imageUrl = new URL(profile.avatarUrl); if (imageUrl.protocol !== 'https:' || !imageUrl.hostname) throw new Error(); } catch { setError('Profile image must be a valid HTTPS URL.'); setNotice(''); return; } } return run('profile', () => onUpdateUser(profile), 'Profile saved.'); }
  function saveProject(event) { event.preventDefault(); if (user.role !== 'owner') return; if (aiApiKey.trim() && (aiApiKey.trim().length < 20 || aiApiKey.trim().length > 4096 || /\s/.test(aiApiKey.trim()))) { setError('Enter a valid API key without spaces (20 to 4096 characters), or leave it blank to use local fallback.'); setNotice(''); return; } return run('project', async () => { await onUpdateWorkspace({ ...project, preferences, aiModel, ...(aiApiKey.trim() ? { aiApiKey: aiApiKey.trim() } : {}), ...(clearAiApiKey ? { clearAiApiKey: true } : {}) }); setAiApiKey(''); setClearAiApiKey(false); }, 'Workspace settings saved.'); }
  async function savePassword(event) {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) { setError('New passwords do not match.'); return; }
    await run('password', async () => { await onChangePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); }, 'Password updated. Other active sessions were signed out.');
  }
  async function changeInvite() {
    setBusy('invite'); setError(''); setNotice('');
    try { const result = await rotateInviteCode(); await onRefreshWorkspace(); setNotice(`New invite code: ${result.workspace.inviteCode}`); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(''); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(workspace.inviteCode); setNotice('Invite code copied.'); setError(''); }
    catch { setError('Clipboard access is unavailable. Copy the code manually.'); }
  }
  function resetProjectForm() {
    setProject({ name: workspace?.name || '', description: workspace?.description || '' });
    setPreferences({ theme: workspace?.preferences?.theme || 'light', notifications: workspace?.preferences?.notifications ?? true, compactMode: workspace?.preferences?.compactMode ?? false });
  }

  return <div className="dashboard-content feature-content settings-content">
    <div className="page-heading feature-heading"><div><div className="eyebrow">WORKSPACE PREFERENCES</div><h1>Settings</h1><p>Manage your profile, project access, and workspace preferences.</p></div><div className="settings-role-chip"><ShieldCheck size={14} />{user.role === 'owner' ? 'Workspace owner' : 'Team member'}</div></div>
    <SettingsNotice notice={notice} error={error} />

    <section className="settings-card"><div className="settings-card-heading"><span className="settings-card-icon profile"><UserRound size={17} /></span><div><h2>Profile settings</h2><p>Your personal details for this workspace.</p></div></div><form className="settings-form" onSubmit={saveProfile}><UserAvatar className="settings-avatar-preview" url={profile.avatarUrl} name={profile.name} /><div className="settings-fields"><label>Full name<input required minLength="2" maxLength="100" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label><label>Email address<input required type="email" maxLength="254" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /><small>Changing email requires your current password.</small></label>{profile.email !== user.email && <label>Current password<input required type="password" autoComplete="current-password" minLength="10" value={profile.currentPassword} onChange={(event) => setProfile((current) => ({ ...current, currentPassword: event.target.value }))} /></label>}<label>Profile image URL<input type="url" placeholder="https://example.com/photo.jpg" value={profile.avatarUrl} onChange={(event) => setProfile((current) => ({ ...current, avatarUrl: event.target.value }))} /><small>Use a reachable HTTPS image. A fallback avatar appears if it cannot load.</small></label><div className="settings-actions"><button className="button button-primary settings-submit" type="submit" disabled={Boolean(busy)}>{busy === 'profile' ? <LoaderCircle className="settings-spin" size={14} /> : <Save size={14} />}Save profile</button><button className="button button-secondary settings-submit" type="button" onClick={() => { setProfile({ name: user.name, email: user.email, avatarUrl: user.avatarUrl || '', currentPassword: '' }); setError(''); setNotice(''); }}>Cancel</button></div></div></form></section>

    <section className="settings-card"><div className="settings-card-heading"><span className="settings-card-icon project"><LockKeyhole size={17} /></span><div><h2>Project settings</h2><p>Details and preferences for {workspace?.name || 'your workspace'}.</p></div>{user.role !== 'owner' && <span className="settings-readonly">Read only</span>}</div><form className="settings-form" onSubmit={saveProject}><div className="settings-fields settings-wide"><label>Project name<input required minLength="2" maxLength="120" disabled={user.role !== 'owner'} value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} /></label><label>Description<textarea maxLength="1000" disabled={user.role !== 'owner'} value={project.description} onChange={(event) => setProject((current) => ({ ...current, description: event.target.value }))} /></label><div className="settings-preference-grid"><label>Theme<select disabled={user.role !== 'owner'} value={preferences.theme} onChange={(event) => setPreferences((current) => ({ ...current, theme: event.target.value }))}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label><label className="settings-toggle"><span><Bell size={14} />Notifications</span><input type="checkbox" disabled={user.role !== 'owner'} checked={preferences.notifications} onChange={(event) => setPreferences((current) => ({ ...current, notifications: event.target.checked }))} /></label><label className="settings-toggle"><span>Compact density</span><input type="checkbox" disabled={user.role !== 'owner'} checked={preferences.compactMode} onChange={(event) => setPreferences((current) => ({ ...current, compactMode: event.target.checked }))} /></label></div></div><div className="settings-actions"><button className="button button-primary settings-submit" type="submit" disabled={Boolean(busy) || user.role !== 'owner'}>{busy === 'project' ? <LoaderCircle className="settings-spin" size={14} /> : <Save size={14} />}Save project settings</button><button className="button button-secondary settings-submit" type="button" onClick={resetProjectForm}>Cancel</button></div></form></section>

    <section className="settings-card"><div className="settings-card-heading"><span className="settings-card-icon team"><Users size={17} /></span><div><h2>Team management</h2><p>People who can access this workspace.</p></div><span className="settings-member-count">{team.length} members</span></div><div className="settings-team-list">{team.map((member) => <div className="settings-team-member" key={member.id}><span className="settings-member-avatar">{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{member.name}{member.id === user.id ? ' (you)' : ''}</strong><small>{member.email}</small></span><span className={`settings-member-role ${member.role}`}>{member.role}</span></div>)}</div>{workspace?.inviteCode && user.role === 'owner' && <div className="settings-invite"><div><strong>Invite teammates</strong><small>Share this code to let a teammate join your workspace.</small><code>{workspace.inviteCode}</code></div><button type="button" className="button button-secondary" onClick={copyInvite}><Clipboard size={14} />Copy</button><button type="button" className="button button-secondary" onClick={changeInvite} disabled={Boolean(busy)}>{busy === 'invite' ? <LoaderCircle className="settings-spin" size={14} /> : <RefreshCw size={14} />}Rotate</button></div>}</section>

    <section className="settings-card"><div className="settings-card-heading"><span className="settings-card-icon ai"><KeyRound size={17} /></span><div><h2>AI configuration</h2><p>Provider credentials stay on the backend and are never returned to the browser.</p></div><span className={`settings-ai-status ${workspace?.aiConfigured ? 'ready' : ''}`}>{workspace?.aiConfigured ? 'Provider ready' : 'Local fallback'}</span></div><form className="settings-form" onSubmit={saveProject}><div className="settings-fields settings-wide"><label>Model name<input disabled={user.role !== 'owner'} value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="gpt-6-astra" /></label>{workspace?.canConfigureAiKey ? <label>OpenAI API key<input type="password" autoComplete="new-password" value={aiApiKey} onChange={(event) => { setAiApiKey(event.target.value); setClearAiApiKey(false); }} placeholder={workspace.aiConfigured ? 'Key is saved securely. Enter a new key to replace it.' : 'Paste key to store encrypted'} disabled={user.role !== 'owner'} /></label> : <div className="settings-ai-help">Add <code>SETTINGS_ENCRYPTION_KEY</code> (32+ characters) in <code>backend/.env</code> to store a workspace key securely, or configure <code>OPENAI_API_KEY</code> there for server-wide access.</div>}{workspace?.aiConfigured && user.role === 'owner' && <label className="settings-toggle"><span>Remove saved workspace key</span><input type="checkbox" checked={clearAiApiKey} onChange={(event) => setClearAiApiKey(event.target.checked)} /></label>}</div><div className="settings-actions"><button className="button button-primary settings-submit" type="submit" disabled={Boolean(busy) || user.role !== 'owner'}>{busy === 'project' ? <LoaderCircle className="settings-spin" size={14} /> : <Save size={14} />}Save AI settings</button><button className="button button-secondary settings-submit" type="button" onClick={() => { setAiModel(workspace?.aiModel || 'gpt-6-astra'); setAiApiKey(''); setClearAiApiKey(false); }}>Cancel</button></div></form></section>

    <section className="settings-card"><div className="settings-card-heading"><span className="settings-card-icon security"><KeyRound size={17} /></span><div><h2>Password and security</h2><p>Update your password. Other sessions will be signed out.</p></div></div><form className="settings-form" onSubmit={savePassword}><div className="settings-fields settings-password-fields"><label>Current password<input required type="password" autoComplete="current-password" minLength="10" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} /></label><label>New password<input required type="password" autoComplete="new-password" minLength="10" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} /></label><label>Confirm new password<input required type="password" autoComplete="new-password" minLength="10" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} /></label></div><div className="settings-actions"><button className="button button-primary settings-submit" type="submit" disabled={Boolean(busy)}>{busy === 'password' ? <LoaderCircle className="settings-spin" size={14} /> : <Check size={14} />}Update password</button><button className="button button-secondary settings-submit" type="button" onClick={() => setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })}>Cancel</button></div></form></section>
  </div>;
}
