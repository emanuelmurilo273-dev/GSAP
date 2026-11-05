/** Normaliza telefone brasileiro para o formato internacional usado pelo wa.me (somente dígitos). */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d; // DDD + número
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

/** Celulares brasileiros têm 9 dígitos começando com 9 após o DDD. */
export function isLikelyMobile(waNumber: string): boolean {
  return /^55\d{2}9\d{8}$/.test(waNumber);
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const n = toWhatsAppNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/**
 * Normaliza um número de WhatsApp para o formato do wa.me (só dígitos, com código do país).
 * Números brasileiros sem DDI ganham 55; aceita outros países com 11 a 15 dígitos.
 */
export function normalizeWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.startsWith("55")) return /^55\d{10,11}$/.test(d) ? d : null;
  return /^\d{11,15}$/.test(d) ? d : null;
}

/** Link de conversa com texto pronto: https://wa.me/NUMERO?text=TEXTO_CODIFICADO (o envio é sempre manual). */
export function waMeLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function isBrMobile(waNumber: string | null): boolean {
  return !!waNumber && /^55\d{2}9\d{8}$/.test(waNumber);
}
