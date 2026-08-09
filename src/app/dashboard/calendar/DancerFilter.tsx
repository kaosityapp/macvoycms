'use client';

import { useRouter, usePathname } from 'next/navigation';

export interface DancerOption {
  id: string;
  name: string;
  color: string;
}

export function DancerFilter({
  dancers,
  selected,
  month,
}: {
  dancers: DancerOption[];
  selected: Set<string>;
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const allSelected = dancers.every((d) => selected.has(d.id));

  function navigate(ids: string[]) {
    const params = new URLSearchParams({ month });
    // Omit `dancers` entirely when everyone is selected — that's the default.
    if (ids.length > 0 && ids.length < dancers.length) {
      params.set('dancers', ids.join(','));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Never allow zero dancers selected — that would show a blank calendar.
    navigate(next.size === 0 ? dancers.map((d) => d.id) : [...next]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => navigate(dancers.map((d) => d.id))}
        className={`rounded-full px-3 py-1 text-sm font-medium transition ${
          allSelected
            ? 'bg-brand-pink text-white'
            : 'border border-brand-ink/15 text-brand-ink/70 hover:bg-brand-pink/5'
        }`}
      >
        All dancers
      </button>
      {dancers.map((d) => {
        const active = selected.has(d.id);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => toggle(d.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
              active
                ? 'border-transparent text-white'
                : 'border-brand-ink/15 text-brand-ink/70 hover:bg-brand-ink/5'
            }`}
            style={active ? { backgroundColor: d.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : d.color }}
            />
            {d.name}
          </button>
        );
      })}
    </div>
  );
}
