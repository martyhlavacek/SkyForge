import type { ValidationError } from '../schemas/validation';

/**
 * Validation panel (Sprint 8.2): lists reference errors from the working
 * copy, plus any import parse error. Green when clean.
 */
export function ValidationPanel({
  errors,
  importError,
}: {
  errors: ValidationError[];
  importError: string | null;
}) {
  return (
    <div className="validation">
      <p className="section-title">Validation</p>
      {importError && (
        <div className="item error">
          <b>Import error:</b>
          <pre style={{ margin: '4px 0 0' }}>{importError}</pre>
        </div>
      )}
      {errors.length === 0 && !importError && (
        <div className="ok">✓ No reference errors.</div>
      )}
      {errors.map((e, i) => (
        <div key={i} className="item error">
          <b>{e.file}</b> — {e.message}
        </div>
      ))}
    </div>
  );
}
