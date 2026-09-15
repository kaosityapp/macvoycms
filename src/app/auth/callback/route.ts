import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/safeNext';

/**
 * OAuth / magic-link callback (PKCE). Exchanges the `code` for a session, then
 * redirects to `next`. Only completes in the browser that requested the link —
 * password resets use /auth/confirm instead for that reason.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'), '/dashboard');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.warn('auth/callback exchange failed:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
