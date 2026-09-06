'use client';

import { removeStudent } from '../actions';

export function CancelStudentButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <form
      action={removeStudent}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Cancel ${name}? This stops future billing and removes them from their class(es). Their record, payment history, and waivers are kept — you can reactivate any time.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="member_id" value={memberId} />
      <button
        type="submit"
        className="rounded-md border border-brand-ink/30 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-ink/5"
      >
        Cancel student
      </button>
    </form>
  );
}
