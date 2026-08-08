import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function FamiliesPage() {
  const supabase = await createClient();
  const { data: families } = await supabase
    .from('family_accounts')
    .select('id, parent1_name, parent1_email, family_members(first_name, last_name)')
    .order('parent1_name', { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-pink">Families</h1>

      <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
        {(families ?? []).map((f: any) => (
          <li key={f.id}>
            <Link
              href={`/admin/families/${f.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-brand-pink/5"
            >
              <div>
                <div className="font-medium text-brand-ink">{f.parent1_name}</div>
                <div className="text-sm text-brand-ink/60">{f.parent1_email}</div>
              </div>
              <div className="max-w-[50%] text-right text-sm text-brand-ink/60">
                {(f.family_members ?? []).map((m: any) => `${m.first_name} ${m.last_name}`).join(', ') ||
                  'No dancers'}
              </div>
            </Link>
          </li>
        ))}
        {(families ?? []).length === 0 && (
          <li className="px-5 py-6 text-brand-ink/60">No families registered yet.</li>
        )}
      </ul>
    </div>
  );
}
