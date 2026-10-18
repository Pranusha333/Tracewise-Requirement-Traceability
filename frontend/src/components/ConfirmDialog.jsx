import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ requirement, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="dialog-card confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        <span className="confirm-icon"><AlertTriangle size={21} /></span>
        <h2 id="delete-title">Delete this requirement?</h2>
        <p id="delete-description"><strong>{requirement.id}</strong> - {requirement.title} and its traceability links will be removed. Test cases linked only to this requirement will also be deleted; test cases shared with other requirements will remain linked to those requirements. This action cannot be undone.</p>
        {error && <p className="form-submit-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onCancel} disabled={deleting}>Keep requirement</button><button className="button button-danger" type="button" onClick={onConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete requirement'}</button></div>
      </section>
    </div>
  );
}
