import nodemailer from "nodemailer";
import { env } from "./env";
import { log } from "./logger";

/** Envia e-mail via SMTP. Sem SMTP configurado, registra no log (modo desenvolvimento). */
export async function sendEmail(to: string, subject: string, text: string) {
  const smtp = env.smtp;
  if (!smtp) {
    log("warn", "email_not_configured", { to, subject, preview: text.slice(0, 500) });
    return { sent: false };
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  await transport.sendMail({ from: smtp.from, to, subject, text });
  return { sent: true };
}
