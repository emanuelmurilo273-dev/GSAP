import { HttpError, json, route } from "@/lib/http";

// Lista oficial de municípios do IBGE (API pública de localidades).
export const GET = route(async (req) => {
  const uf = new URL(req.url).searchParams.get("uf")?.toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(uf)) throw new HttpError(400, "UF inválida.");
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { next: { revalidate: 86400 * 7 } });
  if (!res.ok) return json({ cities: [] });
  const data = (await res.json()) as { nome: string }[];
  return json({ cities: data.map((c) => c.nome) });
});
