import { X } from 'lucide-react';

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(value));
}

export default function RequirementDetailsModal({ requirement, onClose, onEdit }) {
  return (
    <div className="dialog-backdrop details-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card details-dialog" role="dialog" aria-modal="true" aria-labelledby="requirement-details-title">
        <div className="dialog-heading"><div><span className="dialog-kicker">{requirement.id}</span><h2 id="requirement-details-title">{requirement.title}</h2><p>Complete requirement details.</p></div><button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>
        <p className="details-description">{requirement.description}</p>
        <dl className="details-grid">
          <div><dt>Type</dt><dd>{requirement.type}</dd></div>
          <div><dt>Priority</dt><dd><span className={`req-priority ${requirement.priority.toLowerCase()}`}>{requirement.priority}</span></dd></div>
          <div><dt>Status</dt><dd><span className={`req-status ${requirement.status.toLowerCase().replace(' ', '-')}`}><i />{requirement.status}</span></dd></div>
          <div><dt>Created</dt><dd>{formatDate(requirement.createdAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(requirement.updatedAt)}</dd></div>
        </dl>
        <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>Close</button><button className="button button-primary" type="button" onClick={() => onEdit(requirement)}>Edit requirement</button></div>
      </section>
    </div>
  );
}
