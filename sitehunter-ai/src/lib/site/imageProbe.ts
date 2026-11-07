import { assertPublic } from "../leads/safeFetch";

// Confere se uma imagem externa abre e qual a largura real, lendo só o começo do arquivo
// (cabeçalho JPEG/PNG/WebP/GIF). Mesma proteção contra SSRF da verificação de sites.

export type ProbeResult = { ok: true; width: number | null; height: number | null; type: string } | { ok: false; reason: string };

/** Lê largura e altura do cabeçalho de JPEG, PNG, GIF ou WebP. Função pura (testável). */
export function imageSize(buf: Uint8Array): { width: number; height: number; type: string } | null {
  const u16 = (i: number) => (buf[i]! << 8) | buf[i + 1]!;
  const u16le = (i: number) => buf[i]! | (buf[i + 1]! << 8);
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const v = new DataView(buf.buffer, buf.byteOffset);
    return { width: v.getUint32(16), height: v.getUint32(20), type: "png" };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { width: u16le(6), height: u16le(8), type: "gif" };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45) {
    const chunk = String.fromCharCode(buf[12]!, buf[13]!, buf[14]!, buf[15]!);
    if (chunk === "VP8X") return { width: 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16)), height: 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16)), type: "webp" };
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff, type: "webp" };
    if (chunk === "VP8L") { const b0 = buf[21]!, b1 = buf[22]!, b2 = buf[23]!, b3 = buf[24]!; return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)), type: "webp" }; }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: u16(i + 7), height: u16(i + 5), type: "jpeg" };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

export async function probeImage(input: string, timeoutMs = 8000): Promise<ProbeResult> {
  let url: URL;
  try { url = new URL(input); } catch { return { ok: false, reason: "endereço inválido" }; }
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    for (let hop = 0; hop < 4; hop++) {
      await assertPublic(url);
      const res = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": "SiteHunterAI/1.0 (verificação de imagem)", Range: "bytes=0-131071", Accept: "image/*" }, cache: "no-store" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, url); continue; }
      if (res.status >= 400) return { ok: false, reason: `HTTP ${res.status}` };
      if (!/^image\//i.test(res.headers.get("content-type") ?? "image/")) return { ok: false, reason: "não é imagem" };
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (reader && size < 131072) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.byteLength; }
      await reader?.cancel().catch(() => undefined);
      const buf = new Uint8Array(size);
      let o = 0;
      for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.byteLength, size - o)), o); o += c.byteLength; }
      const dim = imageSize(buf);
      return { ok: true, width: dim?.width ?? null, height: dim?.height ?? null, type: dim?.type ?? "desconhecido" };
    }
    return { ok: false, reason: "redirecionamentos demais" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "não respondeu a tempo" : "não abriu" };
  }
}
