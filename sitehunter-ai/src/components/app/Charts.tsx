"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltip = { contentStyle: { background: "#0e1626", border: "1px solid rgba(59,130,246,.3)", borderRadius: 12, color: "#e2e8f0", fontSize: 12 }, cursor: { fill: "rgba(59,130,246,.06)" } };

export function ActivityChart({ data }: { data: { label: string; sites: number; propostas: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="gSites" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
          <linearGradient id="gProp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
        <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip {...tooltip} />
        <Area type="monotone" dataKey="sites" name="Sites criados" stroke="#3b82f6" strokeWidth={2} fill="url(#gSites)" />
        <Area type="monotone" dataKey="propostas" name="Propostas" stroke="#22d3ee" strokeWidth={2} fill="url(#gProp)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { label: string; bruto: number; liquido: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
        <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
        <Tooltip {...tooltip} formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Bar dataKey="bruto" name="Recebido (bruto)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
        <Bar dataKey="liquido" name="Líquido" fill="#22d3ee" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
