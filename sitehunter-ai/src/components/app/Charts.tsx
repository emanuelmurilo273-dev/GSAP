"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltip = { contentStyle: { background: "#1a1816", border: "1px solid rgba(255,122,47,.3)", borderRadius: 12, color: "#ece7e1", fontSize: 12 }, cursor: { fill: "rgba(255,122,47,.06)" } };

export function ActivityChart({ data }: { data: { label: string; sites: number; propostas: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gSites" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff7a2f" stopOpacity={0.45} /><stop offset="100%" stopColor="#ff7a2f" stopOpacity={0} /></linearGradient>
          <linearGradient id="gProp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffc15e" stopOpacity={0.35} /><stop offset="100%" stopColor="#ffc15e" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
        <XAxis dataKey="label" stroke="#8a837a" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="#8a837a" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip {...tooltip} />
        <Area type="monotone" dataKey="sites" name="Sites criados" stroke="#ff7a2f" strokeWidth={2} fill="url(#gSites)" />
        <Area type="monotone" dataKey="propostas" name="Propostas" stroke="#ffc15e" strokeWidth={2} fill="url(#gProp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { label: string; bruto: number; liquido: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
        <XAxis dataKey="label" stroke="#8a837a" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#8a837a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
        <Tooltip {...tooltip} formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Bar dataKey="bruto" name="Recebido (bruto)" fill="#ff7a2f" radius={[6, 6, 0, 0]} />
        <Bar dataKey="liquido" name="Líquido" fill="#ffc15e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
