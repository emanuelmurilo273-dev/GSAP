import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/** ENCRYPTION_KEY: 32 bytes em hex (64 chars) ou base64. Gere com: openssl rand -hex 32 */
function getKey(raw = process.env.ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error('ENCRYPTION_KEY ausente');
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY precisa ter 32 bytes (AES-256)');
  return key;
}

/** AES-256-GCM. Formato: v1:iv:tag:ciphertext (base64). */
export function encrypt(plain: string, key = getKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(payload: string, key = getKey()): string {
  const [v, iv, tag, ct] = payload.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('formato de segredo inválido');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
