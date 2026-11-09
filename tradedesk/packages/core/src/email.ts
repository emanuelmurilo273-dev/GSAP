export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'NEONDESK';

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY ausente — e-mail não enviado:', subject);
    return false;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`, to, subject, html }),
  });
  if (!r.ok) console.error('[email] falha', r.status, await r.text());
  return r.ok;
}

/** Layout simples no estilo terminal para todos os e-mails. */
export function emailLayout(title: string, body: string): string {
  return `<div style="background:#050a07;padding:24px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#c9f7da">
  <div style="max-width:560px;margin:auto;border:1px solid #123524;padding:24px;background:#08110c">
    <div style="color:#39ff88;font-size:18px;margin-bottom:16px">&gt; ${APP_NAME} · ${title}</div>
    ${body}
    <p style="color:#6b8f7a;font-size:11px;margin-top:24px;border-top:1px solid #123524;padding-top:12px">
    Resultados passados não garantem resultados futuros. O robô pode ter prejuízo. Não é recomendação de investimento.</p>
  </div></div>`;
}
