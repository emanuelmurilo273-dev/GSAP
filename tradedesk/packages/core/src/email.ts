export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'HEXADESK';

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

const DOTS = ['#4da3ff', '#ffa94d', '#a478ff', '#3ddc84', '#ff5c9a', '#2dd4bf'];

/** Template terminal para TODOS os e-mails (boas-vindas, cobrança, relatório, alertas). Inline CSS: funciona em Gmail/Outlook. */
export function emailLayout(title: string, body: string): string {
  const dots = DOTS.map((c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px"></span>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#05070a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070a;padding:28px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#0a0f14;border:1px solid #1b2733;border-radius:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e6edf3">
    <tr><td style="padding:22px 26px 0 26px">${dots}<span style="color:#8392a1;font-size:11px;letter-spacing:.18em;margin-left:6px">${APP_NAME}</span></td></tr>
    <tr><td style="padding:14px 26px 4px 26px;color:#3ddc84;font-size:18px;font-weight:700">&gt; ${title}<span style="color:#3ddc84">▍</span></td></tr>
    <tr><td style="padding:10px 26px 22px 26px;font-size:14px;line-height:1.6;color:#e6edf3">${body}</td></tr>
    <tr><td style="padding:14px 26px;border-top:1px solid #1b2733;color:#8392a1;font-size:11px;line-height:1.5">
      ⚠ Resultados passados não garantem resultados futuros. O robô pode ter prejuízo. Não é recomendação de investimento.</td></tr>
  </table></td></tr></table></body></html>`;
}
