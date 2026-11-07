/** Normaliza telefone brasileiro para o formato internacional usado pelo wa.me (somente dígitos). */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  // Celular no formato antigo, sem o nono dígito (DDD + 8 dígitos começando em 6 a 9): desde 2016
  // todo celular brasileiro tem o 9 na frente, e é assim que o WhatsApp o reconhece.
  if (d.startsWith("55") && d.length === 12 && /^[6-9]$/.test(d[4]!)) d = d.slice(0, 4) + "9" + d.slice(4); // DDD + número
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
  if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1); // 0 + DDD (discagem nacional)
  if (d.length === 10 || d.length === 11) d = "55" + d;
  // Celular no formato antigo, sem o nono dígito (DDD + 8 dígitos começando em 6 a 9): desde 2016
  // todo celular brasileiro tem o 9 na frente, e é assim que o WhatsApp o reconhece.
  if (d.startsWith("55") && d.length === 12 && /^[6-9]$/.test(d[4]!)) d = d.slice(0, 4) + "9" + d.slice(4);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return validBr(d) ? d : null;
  return /^\d{11,15}$/.test(d) && !d.startsWith("55") ? d : null;
}

/** Brasil: DDD existente; celular = 9 + 8 dígitos; fixo (WhatsApp Business) = 8 dígitos começando em 2 a 5. */
export function validBr(d: string): boolean {
  const ddd = Number(d.slice(2, 4));
  if (!BR_DDDS.has(ddd)) return false;
  const local = d.slice(4);
  return local.length === 9 ? local[0] === "9" : /^[2-5]\d{7}$/.test(local);
}

/** DDDs em uso no Brasil (Anatel). */
export const BR_DDDS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);

/** Link de conversa com texto pronto: https://wa.me/NUMERO?text=TEXTO_CODIFICADO (o envio é sempre manual). */
export function waMeLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function isBrMobile(waNumber: string | null): boolean {
  return !!waNumber && /^55\d{2}9\d{8}$/.test(waNumber);
}
