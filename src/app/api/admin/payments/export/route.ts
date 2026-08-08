import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';

/** CSV cell escaping (quote-wrap, double embedded quotes). */
function cell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * GET /api/admin/payments/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Streams a CSV of payments for year-end tax use (spec §3.3, §7). Admin only.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = await createClient();
  let query = supabase
    .from('payments')
    .select(
      'paid_at, amount, category, helcim_transaction_id, late_fee_amount, family_members(first_name, last_name)',
    )
    .order('paid_at', { ascending: true });

  if (from) query = query.gte('paid_at', from);
  if (to) query = query.lte('paid_at', `${to}T23:59:59`);

  const { data, error } = await query;
  if (error) return new NextResponse('Export failed', { status: 500 });

  const header = ['Paid at', 'Dancer', 'Category', 'Amount', 'Late fee', 'Helcim transaction'];
  const rows = (data ?? []).map((p: any) => [
    p.paid_at ?? '',
    p.family_members ? `${p.family_members.first_name} ${p.family_members.last_name}` : '',
    p.category ?? '',
    p.amount ?? '',
    p.late_fee_amount ?? '',
    p.helcim_transaction_id ?? '',
  ]);

  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const stamp = `${from ?? 'all'}_to_${to ?? 'all'}`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="macvoy_payments_${stamp}.csv"`,
    },
  });
}
