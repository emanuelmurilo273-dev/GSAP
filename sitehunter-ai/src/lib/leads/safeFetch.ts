import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Busca HTTP para endereços públicos apenas (proteção contra SSRF):
// só http/https, portas padrão, IPs privados/reservados bloqueados,
// redirecionamentos conferidos um a um, tempo e tamanho limitados.

export class BlockedAddressError extends Error {}

function ipv4Private(ip: string) {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Private(ip);
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return ipv4Private(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff");
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedAddressError("protocolo não permitido");
  if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedAddressError("porta não permitida");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new BlockedAddressError("host interno");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new BlockedAddressError("endereço privado");
}

export type SafeResponse = { status: number; finalUrl: string; body: string; ms: number; contentType: string };

export async function safeFetch(input: string, opts: { userAgent: string; timeoutMs?: number; maxBytes?: number; maxRedirects?: number }): Promise<SafeResponse> {
  const start = Date.now();
  let url = new URL(input);
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 7000);
  for (let i = 0; i <= (opts.maxRedirects ?? 3); i++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": opts.userAgent, Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" }, cache: "no-store" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    const max = opts.maxBytes ?? 1_000_000;
    let body = "";
    if (res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        body += dec.decode(value, { stream: true });
        if (size >= max) {
          await reader.cancel();
          break;
        }
      }
    }
    return { status: res.status, finalUrl: url.toString(), body, ms: Date.now() - start, contentType: res.headers.get("content-type") ?? "" };
  }
  throw new Error("redirecionamentos demais");
}
