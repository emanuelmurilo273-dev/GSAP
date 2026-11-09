import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL('/', req.url));
}
