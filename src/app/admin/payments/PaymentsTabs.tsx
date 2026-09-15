'use client';

import { Fragment, useState } from 'react';
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

export interface BatchItemRow {
  invoiceNumber: string | null;
  /** Dancer this payment belongs to, matched from our own records. */
  dancerName: string | null;
  /** Name on the card, as a fallback when we can't match the invoice. */
  payerName: string | null;
  amount: number;
  type: string;
  date: string | null;
}

export interface BatchRow {
  id: string;
  method: 'card' | 'ach';
  batchNumber: number | null;
  amount: number;
  dateClosed: string | null;
  estimatedDepositDate: string | null;
  items: BatchItemRow[];
}

type Tab = 'late' | 'recent' | 'upcoming' | 'deposits';

export function PaymentsTabs({
  late,
  recent,
  recentTotalCount,
  upcoming,
  batches,
}: {
  late: LateRow[];
  recent: RecentRow[];
  recentTotalCount: number;
  upcoming: UpcomingRow[];
  batches: BatchRow[];
}) {
  const [tab, setTab] = useState<Tab>(late.length > 0 ? 'late' : 'recent');
  const [openBatch, setOpenBatch] = useState<string | null>(null);

  const lateTotal = late.reduce((sum, l) => sum + l.amount, 0);
  const recentTotal = recent.reduce((sum, r) => sum + r.amount, 0);
  const upcomingTotal = upcoming.reduce((sum, u) => sum + u.amount, 0);
  const batchesTotal = batches.reduce((sum, b) => sum + b.amount, 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'late', label: `Late Payments (${late.length})` },
    { key: 'recent', label: `Recent Payments (${recentTotalCount})` },
    { key: 'upcoming', label: `Upcoming Payments (${upcoming.length})` },
    { key: 'deposits', label: `Bank Deposits (${batches.length})` },
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

      {tab === 'deposits' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-pink">Bank deposits</h2>
            <span className="text-sm text-brand-ink/60">Total: {money(batchesTotal)}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                  <th className="px-5 py-2 font-medium">Method</th>
                  <th className="px-5 py-2 font-medium">Batch date</th>
                  <th className="px-5 py-2 font-medium">Amount</th>
                  <th className="px-5 py-2 font-medium">Est. bank deposit date</th>
                  <th className="px-5 py-2 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink/10">
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-4 text-brand-ink/60">
                      No batches yet.
                    </td>
                  </tr>
                )}
                {batches.map((b) => {
                  const key = `${b.method}-${b.id}`;
                  const open = openBatch === key;
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td className="px-5 py-2 text-brand-ink">
                          {b.method === 'card' ? 'Credit card' : 'Bank (ACH/EFT)'}
                        </td>
                        <td className="px-5 py-2 text-brand-ink/70">
                          {b.dateClosed ? formatDateShort(b.dateClosed.slice(0, 10)) : '—'}
                        </td>
                        <td className="px-5 py-2 font-medium text-brand-ink">{money(b.amount)}</td>
                        <td className="px-5 py-2 text-brand-ink/70">
                          {b.estimatedDepositDate ? formatDateShort(b.estimatedDepositDate) : '—'}
                        </td>
                        <td className="px-5 py-2 text-right">
                          {b.items.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setOpenBatch(open ? null : key)}
                              aria-expanded={open}
                              className="text-sm font-medium text-brand-pink hover:underline"
                            >
                              {open ? 'Hide' : `What's included (${b.items.length})`}
                            </button>
                          ) : (
                            <span className="text-sm text-brand-ink/40">—</span>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-brand-ink/[0.02]">
                          <td colSpan={5} className="px-5 py-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-brand-ink/50">
                                  <th className="py-1 font-medium">Date</th>
                                  <th className="py-1 font-medium">Who</th>
                                  <th className="py-1 font-medium">Reference</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.items.map((it, i) => (
                                  <tr key={`${it.invoiceNumber ?? 'x'}-${i}`}>
                                    <td className="py-1 text-brand-ink/70">
                                      {it.date ? formatDateShort(it.date.slice(0, 10)) : '—'}
                                    </td>
                                    <td className="py-1 text-brand-ink">
                                      <span>{it.dancerName ?? it.payerName ?? 'Unmatched'}</span>
                                      {it.type === 'reverse' || it.type === 'refund' ? (
                                        <span className="ml-2 text-xs text-brand-ink/50">
                                          {it.type === 'refund' ? '(refunded)' : '(reversed)'}
                                        </span>
                                      ) : null}
                                      {it.dancerName && it.payerName && it.dancerName !== it.payerName ? (
                                        <span className="ml-2 text-xs text-brand-ink/50">
                                          paid by {it.payerName}
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="py-1 font-mono text-xs text-brand-ink/50">
                                      {it.invoiceNumber ?? '—'}
                                    </td>
                                    <td
                                      className={`py-1 text-right font-medium ${
                                        it.amount < 0 ? 'text-brand-ink/50' : 'text-brand-ink'
                                      }`}
                                    >
                                      {money(it.amount)}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t border-brand-ink/10">
                                  <td colSpan={3} className="py-1 text-brand-ink/60">
                                    Batch total
                                  </td>
                                  <td className="py-1 text-right font-semibold text-brand-ink">
                                    {money(b.amount)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-brand-ink/50">
            A deposit is the <em>total</em> of everything in that batch, so it rarely matches any
            one person&apos;s bill — open &ldquo;What&apos;s included&rdquo; to see the payments
            behind it. Amounts are what each family was charged including the processing fee, and
            anything reversed or refunded is subtracted.
          </p>
          <p className="text-xs text-brand-ink/50">
            Deposit dates above are an estimate based on Helcim&apos;s standard payout timeline
            (Helcim&apos;s API doesn&apos;t report the actual deposit date) — actual timing can
            vary, especially around weekends and holidays. Once your batches are processed,
            Helcim automatically deposits the funds into your bank account. Learn more about{' '}
            <a
              href="https://learn.helcim.com/docs/when-to-expect-a-deposit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-pink underline"
            >
              our payout timelines here
            </a>
            .
          </p>
        </div>
      )}
    </section>
  );
}
