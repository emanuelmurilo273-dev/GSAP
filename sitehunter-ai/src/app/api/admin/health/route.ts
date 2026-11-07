import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { env } from "@/lib/env";
import { OVERPASS_MIRRORS } from "@/lib/leads/providers/osm";

// Testa agora cada servidor do Overpass (consulta mínima, 6 s) e o Nominatim. Só administrador; nada é gravado.
async function ping(name: string, url: string, init: RequestInit): Promise<{ name: string; ok: boolean; ms: number; detail: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "SiteHunterAI-health/1.0", ...(init.headers ?? {}) } });
    return { name, ok: res.ok, ms: Date.now() - t0, detail: res.ok ? "respondeu" : `HTTP ${res.status}` };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t0, detail: e instanceof Error && e.name === "TimeoutError" ? "sem resposta em 6 s" : "falha de conexão" };
  }
}

export const GET = route(async () => {
  await requireAdmin();
  const servers = [...new Set([env.overpassUrl, ...OVERPASS_MIRRORS].filter((x): x is string => !!x))];
  const overpass = await Promise.all(servers.map((u) => ping(`Overpass · ${new URL(u).host}`, u, { method: "POST", body: new URLSearchParams({ data: "[out:json][timeout:5];node(1);out count;" }) })));
  const nominatim = await ping("Nominatim (openstreetmap.org)", "https://nominatim.openstreetmap.org/status.php?format=json", { method: "GET" });
  return json({ checkedAt: new Date().toISOString(), results: [...overpass, nominatim] });
}, { csrf: false });
