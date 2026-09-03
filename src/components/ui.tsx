'use client';

import { useFormStatus } from 'react-dom';

export const inputClass =
  'w-full rounded-md border border-brand-ink/20 bg-white px-3 py-2 text-brand-ink shadow-sm focus:border-brand-pink focus:outline-none focus:ring-1 focus:ring-brand-pink';

export const labelClass = 'block text-sm font-medium text-brand-ink';

export const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-brand-pink px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-pink/90 disabled:cursor-not-allowed disabled:opacity-60';

export function Field({
  label,
  htmlFor,
  required,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-brand-ink/60">{hint}</p>}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText = 'Working…',
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  /** Extra condition (e.g. "not all required boxes checked yet") beyond the built-in pending state. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
      {message}
    </p>
  );
}
