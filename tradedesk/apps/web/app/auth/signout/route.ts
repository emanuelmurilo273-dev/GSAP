import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { publicUrl } from '@/lib/public-url';

export async function GET(req: NextRequest) {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(publicUrl(req, '/'));
}
