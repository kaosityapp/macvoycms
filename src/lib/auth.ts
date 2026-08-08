import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

type FamilyAccount = Database['public']['Tables']['family_accounts']['Row'];

/** The signed-in auth user, or null. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** The family_account attached to the current login, or null. */
export async function getFamilyAccount(): Promise<FamilyAccount | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return data;
}

/** True if the current login is in the admins table. */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(data);
}

/** Require an admin user; redirect otherwise. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!(await isAdmin())) redirect('/dashboard');
  return user;
}
