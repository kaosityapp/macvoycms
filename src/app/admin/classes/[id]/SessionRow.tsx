'use client';

import { useActionState, useState } from 'react';
import { updateSession, type ActionState } from './actions';
import { SubmitButton, inputClass } from '@/components/ui';
import { formatDateLong, formatTime } from '@/lib/format';

const STATUSES: { value: string; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'removed', label: 'Removed' },
];

interface Session {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  note: string | null;
}

export function SessionRow({ session, classId }: { session: Session; classId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(updateSession, {});
  const [status, setStatus] = useState(session.status);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <input type="hidden" name="session_id" value={session.id} />
      <input type="hidden" name="class_id" value={classId} />

      <div className={`min-w-[12rem] text-sm ${status === 'removed' ? 'opacity-50' : ''}`}>
        <div className="font-medium text-brand-ink">{formatDateLong(session.session_date)}</div>
        <div className="text-brand-ink/60">
          {formatTime(session.start_time)}–{formatTime(session.end_time)}
        </div>
      </div>

      <select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className={`${inputClass} w-36`}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {status === 'rescheduled' && (
        <label className="flex items-center gap-1 text-sm text-brand-ink/70">
          to
          <input
            name="new_date"
            type="date"
            defaultValue={session.session_date}
            required
            className={`${inputClass} w-40`}
          />
        </label>
      )}

      <input
        name="note"
        defaultValue={session.note ?? ''}
        placeholder={status === 'cancelled' ? 'Reason (shown to parents)' : 'Note (optional)'}
        className={`${inputClass} min-w-[10rem] flex-1`}
      />

      <SubmitButton pendingText="Saving…">Save</SubmitButton>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
    </form>
  );
}
