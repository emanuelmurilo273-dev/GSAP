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
