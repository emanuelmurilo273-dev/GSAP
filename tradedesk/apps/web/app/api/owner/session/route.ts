import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { aalOf, auditOwner, ensureOwner, isOwnerEmail } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';

/** Chamada após o login do dono (senha+2FA): promove OWNER_EMAIL e grava no log de auditoria. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !isOwnerEmail(user.email)) return NextResponse.json({ error: 'proibido' }, { status: 403 });
  const admin = supabaseAdmin();
  if (!(await ensureOwner(admin, user))) return NextResponse.json({ error: 'e-mail não confirmado' }, { status: 403 });
  const aal = await aalOf((await supabaseServer()) as any);
  await auditOwner(admin, user, 'owner.login', { aal: aal.current }, req);
  return NextResponse.json({ ok: true, aal: aal.current, home: process.env.OWNER_HOME ?? '/app' });
}
