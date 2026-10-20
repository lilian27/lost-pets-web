import type { ReactNode } from 'react';

interface FieldProps {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="hint">{hint}</small>}
      {error && (
        <small className="field-error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function CharCounter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={over ? 'counter over' : 'counter'} data-testid="char-counter">
      {value.length}/{max}
    </span>
  );
}
