import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';
import { auditOwner } from '@/lib/owner';

/** PARAR TUDO: desliga o robô AGORA no banco (nenhuma nova entrada) e manda o conector zerar as posições. */
export async function POST(req: Request) {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const { admin } = g.data;
  const { command } = await req.json().catch(() => ({}));
  if (command !== 'panic') return NextResponse.json({ error: 'comando inválido' }, { status: 400 });
  await admin.from('b3_settings').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
  const { data } = await admin.from('b3_commands').insert({ command: 'panic' }).select('id').single();
  await admin.from('b3_logs').insert({ level: 'warn', agent: 'risk', message: 'PARAR TUDO acionado no painel. Aguardando o conector zerar as posições.' });
  await auditOwner(admin, { id: g.data.userId, email: g.data.email }, 'b3.panic', { commandId: data?.id }, req);
  return NextResponse.json({ ok: true, commandId: data?.id });
}
