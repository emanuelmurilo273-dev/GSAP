import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Só informa se o pagamento foi confirmado (status gravado exclusivamente pelo webhook validado). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ paid: false });
  const { data } = await supabaseAdmin().from('checkouts').select('status').eq('id', id).maybeSingle();
  return NextResponse.json({ paid: data?.status === 'paid' });
}
