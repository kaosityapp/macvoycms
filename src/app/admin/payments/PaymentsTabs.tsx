'use client';

import { useState } from 'react';
import Link from 'next/link';
import { money, formatDateShort, formatTimestamp } from '@/lib/format';

export interface LateRow {
  memberId: string;
  name: string;
  amount: number;
  date: string;
  attempts: number;
  lastAttemptDate: string | null;
  error: string | null;
}

export interface RecentRow {
  id: string;
  amount: number;
  category: string;
  name: string;
  paidAt: string | null;
}

export interface UpcomingRow {
  name: string;
  date: string;
  amount: number;
}

type Tab = 'late' | 'recent' | 'upcoming';

export function PaymentsTabs({
  late,
  recent,
  recentTotalCount,
  upcoming,
}: {
  late: LateRow[];
  recent: RecentRow[];
  recentTotalCount: number;
  upcoming: UpcomingRow[];
}) {
  const [tab, setTab] = useState<Tab>(late.length > 0 ? 'late' : 'recent');

  const lateTotal = late.reduce((sum, l) => sum + l.amount, 0);
  const recentTotal = recent.reduce((sum, r) => sum + r.amount, 0);
  const upcomingTotal = upcoming.reduce((sum, u) => sum + u.amount, 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'late', label: `Late Payments (${late.length})` },
    { key: 'recent', label: `Recent Payments (${recentTotalCount})` },
    { key: 'upcoming', label: `Upcoming Payments (${upcoming.length})` },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-brand-ink/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-brand-pink text-brand-pink'
                : 'border-transparent text-brand-ink/50 hover:text-brand-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'late' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-pink">Late payments</h2>
            <span className="text-sm text-brand-ink/60">Total owed: {money(lateTotal)}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                  <th className="px-5 py-2 font-medium">Dancer</th>
                  <th className="px-5 py-2 font-medium">Amount owed</th>
                  <th className="px-5 py-2 font-medium">Overdue since</th>
                  <th className="px-5 py-2 font-medium">Attempts</th>
                  <th className="px-5 py-2 font-medium">Last attempt</th>
                  <th className="px-5 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink/10">
                {late.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 text-brand-ink/60">
                      No late payments.
                    </td>
                  </tr>
                )}
                {late.map((l, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2 text-brand-ink">
                      <Link href={`/admin/families/${l.memberId}`} className="hover:underline">
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2 font-medium text-red-700">{money(l.amount)}</td>
                    <td className="px-5 py-2 text-brand-ink/70">{formatDateShort(l.date)}</td>
                    <td className="px-5 py-2 text-brand-ink/70">{l.attempts}</td>
                    <td className="px-5 py-2 text-brand-ink/50">
                      {l.lastAttemptDate ? formatTimestamp(l.lastAttemptDate) : '—'}
                    </td>
                    <td className="px-5 py-2 text-brand-ink/70">{l.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'recent' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-pink">Recent payments</h2>
            <span className="text-sm text-brand-ink/60">
              Total (last {recent.length}): {money(recentTotal)}
            </span>
          </div>
          <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-brand-ink">{money(p.amount)}</span>{' '}
                  <span className="capitalize text-brand-ink/60">· {p.category}</span>{' '}
                  <span className="text-brand-ink/60">· {p.name}</span>
                </div>
                <span className="text-brand-ink/50">{p.paidAt ? formatTimestamp(p.paidAt) : ''}</span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="px-5 py-6 text-brand-ink/60">No payments recorded yet.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-pink">Upcoming payments</h2>
            <span className="text-sm text-brand-ink/60">Total: {money(upcomingTotal)}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                  <th className="px-5 py-2 font-medium">Dancer</th>
                  <th className="px-5 py-2 font-medium">Due date</th>
                  <th className="px-5 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink/10">
                {upcoming.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-brand-ink/60">
                      Nothing scheduled.
                    </td>
                  </tr>
                )}
                {upcoming.map((u, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2 text-brand-ink">{u.name}</td>
                    <td className="px-5 py-2 text-brand-ink/70">{formatDateShort(u.date)}</td>
                    <td className="px-5 py-2 text-brand-ink/70">{money(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
