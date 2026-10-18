import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { requirementPriorities, requirementStatuses, requirementTypes } from '../data/requirements.js';

const emptyForm = { title: '', description: '', type: '', priority: '', status: 'Draft' };

export default function RequirementFormModal({ requirement, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(requirement ? {
    title: requirement.title,
    description: requirement.description,
    type: requirement.type,
    priority: requirement.priority,
    status: requirement.status,
  } : emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  async function submitForm(event) {
    event.preventDefault();
    const nextErrors = {};
    ['title', 'description', 'type', 'priority', 'status'].forEach((key) => {
      if (!form[key].trim()) nextErrors[key] = 'This field is required.';
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await onSave({ ...form, title: form.title.trim(), description: form.description.trim() });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card form-dialog" role="dialog" aria-modal="true" aria-labelledby="requirement-form-title">
        <div className="dialog-heading"><div><span className="dialog-kicker">REQUIREMENT DETAILS</span><h2 id="requirement-form-title">{requirement ? 'Edit requirement' : 'Add requirement'}</h2><p>Capture the details your project team needs.</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
        <form onSubmit={submitForm} noValidate>
          <label className="form-field form-field-wide">Title <span className="required-mark">*</span><input name="title" value={form.title} onChange={updateField} placeholder="e.g. Secure user authentication" aria-invalid={Boolean(errors.title)} autoFocus />{errors.title && <small className="field-error">{errors.title}</small>}</label>
          <label className="form-field form-field-wide">Description <span className="required-mark">*</span><textarea name="description" value={form.description} onChange={updateField} placeholder="Describe what the system must do..." rows="4" aria-invalid={Boolean(errors.description)} />{errors.description && <small className="field-error">{errors.description}</small>}</label>
          <div className="form-select-grid">
            <label className="form-field">Type <span className="required-mark">*</span><select name="type" value={form.type} onChange={updateField} aria-invalid={Boolean(errors.type)}><option value="">Select type</option>{requirementTypes.map((value) => <option key={value}>{value}</option>)}</select>{errors.type && <small className="field-error">{errors.type}</small>}</label>
            <label className="form-field">Priority <span className="required-mark">*</span><select name="priority" value={form.priority} onChange={updateField} aria-invalid={Boolean(errors.priority)}><option value="">Select priority</option>{requirementPriorities.map((value) => <option key={value}>{value}</option>)}</select>{errors.priority && <small className="field-error">{errors.priority}</small>}</label>
            <label className="form-field form-field-wide">Status <span className="required-mark">*</span><select name="status" value={form.status} onChange={updateField} aria-invalid={Boolean(errors.status)}>{requirementStatuses.map((value) => <option key={value}>{value}</option>)}</select>{errors.status && <small className="field-error">{errors.status}</small>}</label>
          </div>
          {error && <p className="form-submit-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : requirement ? 'Save changes' : 'Add requirement'}</button></div>
        </form>
      </section>
    </div>
  );
}
