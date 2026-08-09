'use client';

import { deleteDancer } from '../actions';

export function DeleteDancerButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <form
      action={deleteDancer}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Permanently delete ${name}? This removes their registration, payments, and all records, and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="member_id" value={memberId} />
      <button
        type="submit"
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        Delete permanently
      </button>
    </form>
  );
}
