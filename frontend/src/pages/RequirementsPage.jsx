import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Eye, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import RequirementFormModal from '../components/RequirementFormModal.jsx';
import RequirementDetailsModal from '../components/RequirementDetailsModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { requirementPriorities, requirementStatuses, requirementTypes } from '../data/requirements.js';
import './requirements.css';

const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function RequirementTableHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return <th aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`sortable-heading${active ? ' sorted' : ''}`} type="button" onClick={() => onSort(sortKey)}>{label}<Icon size={13} /></button></th>;
}

export default function RequirementsPage({ requirements, searchTerm, onSearchChange, loading, loadError, onRetry, onCreate, onUpdate, onDelete, openCreateRequest, onCreateRequestHandled }) {
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState({ key: 'updatedAt', direction: 'desc' });
  const [formTarget, setFormTarget] = useState(undefined);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('success');
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (openCreateRequest && !loading) {
      setFormError('');
      setFormTarget(null);
      onCreateRequestHandled();
    }
  }, [openCreateRequest, loading, onCreateRequestHandled]);

  const visibleRequirements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const matches = requirements.filter((item) => {
      const textMatches = !query || `${item.id} ${item.title} ${item.description}`.toLowerCase().includes(query);
      return textMatches && (!typeFilter || item.type === typeFilter) && (!priorityFilter || item.priority === priorityFilter) && (!statusFilter || item.status === statusFilter);
    });

    return matches.sort((left, right) => {
      let comparison;
      if (sort.key === 'priority') comparison = priorityOrder[left.priority] - priorityOrder[right.priority];
      else if (sort.key === 'updatedAt') comparison = new Date(left.updatedAt) - new Date(right.updatedAt);
      else comparison = String(left[sort.key]).localeCompare(String(right[sort.key]));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [requirements, searchTerm, typeFilter, priorityFilter, statusFilter, sort]);

  function changeSort(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  }

  function clearFilters() {
    onSearchChange('');
    setTypeFilter('');
    setPriorityFilter('');
    setStatusFilter('');
  }

  async function saveRequirement(values) {
    setFormSaving(true);
    setFormError('');
    try {
      if (formTarget) {
        await onUpdate(formTarget.id, values);
        setNotice(`${formTarget.id} was updated.`);
      } else {
        const created = await onCreate(values);
        setNotice(`${created.id} was added.`);
      }
      setNoticeType('success');
      setFormTarget(undefined);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormSaving(false);
    }
  }

  function editRequirement(requirement) {
    setDetailsTarget(null);
    setFormTarget(requirement);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(deleteTarget.id);
      setNotice(`${deleteTarget.id} was deleted.`);
      setNoticeType('success');
      setDeleteTarget(null);
      setDetailsTarget(null);
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  }

  const activeFilters = Boolean(searchTerm || typeFilter || priorityFilter || statusFilter);

  return (
    <div className="dashboard-content requirements-content">
      <div className="page-heading requirements-page-heading">
        <div><div className="eyebrow">PROJECT WORKSPACE</div><h1>Requirements</h1><p>Capture, organize, and track your project requirements.</p></div>
        <button className="button button-primary" type="button" disabled={loading} onClick={() => { setFormError(''); setFormTarget(null); }}><Plus size={16} /> Add requirement</button>
      </div>

      <div className="requirements-summary">
        <div><strong>{loading || loadError ? '-' : requirements.length}</strong><span>Total requirements</span></div>
        <div><strong>{loading || loadError ? '-' : requirements.filter((item) => item.status === 'Approved').length}</strong><span>Approved</span></div>
        <div><strong>{loading || loadError ? '-' : requirements.filter((item) => item.status === 'In Progress').length}</strong><span>In progress</span></div>
      </div>

      {loading && <section className="panel requirement-load-state" role="status"><span className="loading-spinner" /><strong>Loading requirements</strong><p>Connecting to your project database...</p></section>}
      {loadError && <section className="panel requirement-load-state requirement-load-error" role="alert"><span className="empty-icon"><X size={19} /></span><strong>Requirements could not be loaded</strong><p>{loadError}</p><button className="button button-secondary" type="button" onClick={onRetry}>Try again</button></section>}

      {!loading && !loadError && <>
      <section className="panel management-panel">
        <div className="management-toolbar">
          <div className="management-title"><div><h2>All requirements</h2><p>Review and maintain your project requirements.</p></div><span className="result-count">{visibleRequirements.length} shown</span></div>
          <div className="filter-row">
            <label className="table-search"><Search size={16} /><input aria-label="Search requirements" placeholder="Search requirements..." value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />{searchTerm && <button type="button" onClick={() => onSearchChange('')} aria-label="Clear search"><X size={14} /></button>}</label>
            <span className="filter-caption"><SlidersHorizontal size={14} /> Filters</span>
            <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{requirementTypes.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">All priorities</option>{requirementPriorities.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{requirementStatuses.map((value) => <option key={value}>{value}</option>)}</select>
            {activeFilters && <button className="clear-filters" type="button" onClick={clearFilters}>Clear</button>}
          </div>
        </div>
        <div className="table-wrap management-table-wrap">
          <table className="management-table">
            <thead><tr><RequirementTableHeader label="REQUIREMENT ID" sortKey="id" sort={sort} onSort={changeSort} /><RequirementTableHeader label="TITLE" sortKey="title" sort={sort} onSort={changeSort} /><RequirementTableHeader label="TYPE" sortKey="type" sort={sort} onSort={changeSort} /><RequirementTableHeader label="PRIORITY" sortKey="priority" sort={sort} onSort={changeSort} /><RequirementTableHeader label="STATUS" sortKey="status" sort={sort} onSort={changeSort} /><RequirementTableHeader label="LAST UPDATED" sortKey="updatedAt" sort={sort} onSort={changeSort} /><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{visibleRequirements.map((item) => (
              <tr key={item.id}>
                <td className="req-id-cell">{item.id}</td>
                <td className="req-title-cell"><strong>{item.title}</strong><small>{item.description}</small></td>
                <td><span className="type-pill">{item.type}</span></td>
                <td><span className={`req-priority ${item.priority.toLowerCase()}`}><i />{item.priority}</span></td>
                <td><span className={`req-status ${item.status.toLowerCase().replace(' ', '-')}`}><i />{item.status}</span></td>
                <td className="req-date-cell">{formatDate(item.updatedAt)}</td>
                <td><div className="requirement-actions"><button type="button" aria-label={`View ${item.id}`} title="View details" onClick={() => setDetailsTarget(item)}><Eye size={16} /></button><button type="button" aria-label={`Edit ${item.id}`} title="Edit requirement" onClick={() => editRequirement(item)}><Pencil size={15} /></button><button className="delete-action" type="button" aria-label={`Delete ${item.id}`} title="Delete requirement" onClick={() => { setDeleteError(''); setDeleteTarget(item); }}><Trash2 size={15} /></button></div></td>
              </tr>
            ))}
            {visibleRequirements.length === 0 && <tr><td colSpan="7"><div className="requirements-empty"><span className="empty-icon"><Search size={19} /></span><strong>{activeFilters ? 'No matching requirements' : 'No requirements yet'}</strong><p>{activeFilters ? 'Try changing or clearing your search and filters.' : 'Add your first requirement to get started.'}</p>{activeFilters && <button type="button" className="button button-secondary" onClick={clearFilters}>Clear filters</button>}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="management-footer"><span>Showing {visibleRequirements.length} of {requirements.length} requirements</span><span>Sorted by {sort.key === 'updatedAt' ? 'last updated' : sort.key} <small>{sort.direction === 'asc' ? '(ascending)' : '(descending)'}</small></span></div>
      </section>
      </>}

      {notice && <div className={`success-toast ${noticeType}`} role="status"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {formTarget !== undefined && <RequirementFormModal requirement={formTarget} onClose={() => setFormTarget(undefined)} onSave={saveRequirement} saving={formSaving} error={formError} />}
      {detailsTarget && <RequirementDetailsModal requirement={detailsTarget} onClose={() => setDetailsTarget(null)} onEdit={editRequirement} />}
      {deleteTarget && <ConfirmDialog requirement={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} deleting={deleting} error={deleteError} />}
    </div>
  );
}
