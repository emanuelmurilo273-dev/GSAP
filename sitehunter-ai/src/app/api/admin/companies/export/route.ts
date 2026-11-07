import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { companyWhere, readFilters } from "@/lib/adminCompanies";
import { formatBrPhone } from "@/lib/whatsapp";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// CSV do que a lista administrativa mostra (mesmos filtros). Só dados publicados nas fontes; nada é enviado a ninguém.
export const GET = route(async (req) => {
  await requireAdmin();
  const f = readFilters(Object.fromEntries(new URL(req.url).searchParams));
  const rows = await prisma.company.findMany({ where: companyWhere(f), orderBy: [{ category: "asc" }, { city: "asc" }, { name: "asc" }], take: 5000, include: { projects: { select: { id: true }, take: 1 } } });
  const head = ["Segmento", "Empresa", "Cidade", "UF", "Telefone", "E-mail", "Site", "Endereço", "Fonte", "Link da fonte", "Situação", "Prévia de site"];
  const lines = [head.map(cell).join(";")];
  for (const c of rows) {
    const situ = c.excludedAt ? "Excluída" : c.contactedAt ? "Contatada" : "Nova";
    lines.push([c.category, c.name, c.city, c.state, c.phone ? formatBrPhone(c.phone) : "", c.email, c.website, c.address, c.source, c.mapsUrl, situ, c.projects.length ? "sim" : "não"].map(cell).join(";"));
  }
  return new Response("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="empresas-hunter.csv"', "Cache-Control": "no-store" } });
}, { csrf: false });
