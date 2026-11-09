/**
 * Cria (ou repara) a conta do DONO: sem checkout, sem assinatura. Idempotente — pode rodar quantas vezes quiser.
 *   Windows: duplo clique em Criar-Dono-Windows.bat
 *   Linha de comando: npx tsx --env-file=.env scripts/criar-dono.ts
 * Precisa no .env: OWNER_EMAIL, SUPABASE_URL, SUPABASE_KEY (service_role). Opcional: RESEND_API_KEY (e-mail com o link).
 * Senha: se OWNER_PASSWORD estiver definida no ambiente, é usada; senão você cria senha + 2FA no 1º acesso (/owner/security).
 */
import { createClient } from '@supabase/supabase-js';

const miss = ['OWNER_EMAIL', 'SUPABASE_URL', 'SUPABASE_KEY'].filter((k) => !process.env[k] || /xxxx|preview/.test(process.env[k]!));
if (miss.length) { console.error(`✖ Faltam no .env: ${miss.join(', ')}\n  (SUPABASE_* devem ser os reais do seu projeto — veja o README, passo "Supabase")`); process.exit(1); }

const email = process.env.OWNER_EMAIL!.trim().toLowerCase();
const app = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(): Promise<string | undefined> {
  const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
  if (data?.id) return data.id;
  for (let page = 1; page <= 20; page++) { // usuário pode existir no Auth sem perfil
    const r = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = r.data?.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if ((r.data?.users.length ?? 0) < 200) break;
  }
}

async function main() {
  const probe = await sb.from('profiles').select('id', { head: true, count: 'exact' });
  if (probe.error) { console.error(`✖ Não consegui ler o banco: ${probe.error.message}\n  Você rodou as migrations 001 e 002 no SQL Editor do Supabase?`); process.exit(1); }

  let id = await findUserId();
  let created = false;
  if (!id) {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, ...(process.env.OWNER_PASSWORD ? { password: process.env.OWNER_PASSWORD } : {}) });
    if (error || !data.user) { console.error(`✖ Erro ao criar usuário: ${error?.message}`); process.exit(1); }
    id = data.user.id; created = true;
  }

  if (!created && process.env.OWNER_PASSWORD) {
    const u = await sb.auth.admin.updateUserById(id, { password: process.env.OWNER_PASSWORD, email_confirm: true });
    if (u.error) { console.error(`✖ Não consegui definir a senha: ${u.error.message}`); process.exit(1); }
  }
  const up = await sb.from('profiles').upsert({ id, email, role: 'owner' });
  if (up.error) { console.error(`✖ Erro ao definir role=owner: ${up.error.message}`); process.exit(1); }
  await sb.from('bot_settings').upsert({ user_id: id }, { ignoreDuplicates: true });
  // dono não tem assinatura: se existir uma de teste antiga, remove para não aparecer em "assinantes"
  await sb.from('subscriptions').delete().eq('user_id', id);
  await sb.from('audit_log').insert({ actor: id, email, action: created ? 'owner.created' : 'owner.repaired', detail: { via: 'scripts/criar-dono' } });

  const check = await sb.from('profiles').select('role').eq('id', id).single();
  if (check.data?.role !== 'owner') { console.error('✖ Verificação falhou: role não ficou owner.'); process.exit(1); }

  const { data: link, error: lerr } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  const url = link?.properties?.hashed_token ? `${app}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=${process.env.OWNER_REQUIRE_2FA === 'false' ? '/b3' : '/owner/security'}` : null;
  if (lerr || !url) { console.error(`✖ Conta ok, mas não gerei o link: ${lerr?.message}`); process.exit(1); }

  let mailed = false;
  if (process.env.RESEND_API_KEY) {
    const { sendEmail, emailLayout } = await import('../packages/core/src/email');
    mailed = await sendEmail(email, 'Seu acesso de dono', emailLayout('acesso do dono', `<p><a style="color:#3ddc84;font-size:16px" href="${url}">&gt; ENTRAR (link único)</a></p><p style="color:#8392a1">Depois do link: defina a senha e ative o 2FA.</p>`));
  }

  console.log(`AUTOLOGIN_URL=${url}`); // lido pelo instalador (abre o navegador já logado)
  console.log(`\n✔ Conta de dono ${created ? 'CRIADA' : 'já existia — reparada'}: ${email}  (role=owner, sem assinatura, nunca bloqueada)`);
  console.log(mailed ? `✔ Link de acesso enviado para ${email}.` : `\nAbra este link (uso único) para entrar agora:\n\n${url}\n`);
  console.log('Depois do link: 1) defina uma senha (12+ caracteres)  2) escaneie o QR no Google Authenticator  3) você cai no painel do robô.');
  console.log('Próximo passo: instale o conector (connector/Instalar-Conector-Windows.bat) e abra o painel B3.');
}
main().catch((e) => { console.error('✖', e?.message ?? e); process.exit(1); });
