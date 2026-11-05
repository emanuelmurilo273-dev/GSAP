import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { citiesOf, searchCities, UFS } from "@/lib/br/cities";

/** Autocompletar de municípios (lista embutida do IBGE; nenhuma chamada externa). */
export const GET = route(async (req) => {
  await requireUser();
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 60);
  const uf = (u.searchParams.get("uf") ?? "").toUpperCase();
  const validUf = UFS[uf] ? uf : null;
  const list = q.trim() ? searchCities(q, validUf, 12) : validUf ? citiesOf(validUf).filter((c) => c.capital).concat(citiesOf(validUf).filter((c) => !c.capital).slice(0, 11)) : [];
  return json({ cities: list.map((c) => ({ ibge: c.ibge, name: c.name, uf: c.uf, capital: c.capital })) });
});
