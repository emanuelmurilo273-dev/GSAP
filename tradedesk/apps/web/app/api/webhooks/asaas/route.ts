import { safeEqual } from '@desk/core';
import { NextResponse } from 'next/server';
import { handleAsaasEvent } from '@/lib/billing';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  const token = req.headers.get('asaas-access-token') ?? '';
  // sem segredo configurado → recusa tudo (nunca libera por padrão)
  if (!secret || !safeEqual(token, secret)) return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'json inválido' }, { status: 400 });
  try {
    const r = await handleAsaasEvent(supabaseAdmin(), body);
    return NextResponse.json(r);
  } catch (e: any) {
    console.error('[asaas webhook]', e);
    // 500 faz o Asaas reenviar o evento
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
