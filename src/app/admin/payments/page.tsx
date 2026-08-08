import { createClient } from '@/lib/supabase/server';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { money, formatTimestamp } from '@/lib/format';
import { inputClass } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from('payments')
    .select('id, amount, category, paid_at, family_members(first_name, last_name)')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(25);

  const payments = (recent ?? []) as any[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Payments</h1>

      {!isHelcimConfigured() && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No payments are recorded yet — they populate automatically from Helcim webhooks once the
          payment processor is connected. The CSV export below already works and will include those
          rows as they arrive.
        </p>
      )}

      {/* CSV export */}
      <section className="space-y-3 rounded-lg border border-brand-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Export for taxes (CSV)</h2>
        <p className="text-sm text-brand-ink/70">
          Download all payments in a date range. Leave dates blank for everything.
        </p>
        <form action="/api/admin/payments/export" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="block text-sm font-medium text-brand-ink">
              From
            </label>
            <input id="from" name="from" type="date" className={inputClass} />
          </div>
          <div>
            <label htmlFor="to" className="block text-sm font-medium text-brand-ink">
              To
            </label>
            <input id="to" name="to" type="date" className={inputClass} />
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pink/90"
          >
            Download CSV
          </button>
        </form>
      </section>

      {/* Recent */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Recent payments</h2>
        <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-brand-ink">{money(p.amount)}</span>{' '}
                <span className="capitalize text-brand-ink/60">· {p.category}</span>{' '}
                <span className="text-brand-ink/60">
                  · {p.family_members ? `${p.family_members.first_name} ${p.family_members.last_name}` : ''}
                </span>
              </div>
              <span className="text-brand-ink/50">{p.paid_at ? formatTimestamp(p.paid_at) : ''}</span>
            </li>
          ))}
          {payments.length === 0 && (
            <li className="px-5 py-6 text-brand-ink/60">No payments recorded yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
