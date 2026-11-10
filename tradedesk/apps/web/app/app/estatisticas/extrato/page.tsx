import { computeStats } from '@desk/core';
import { requireSubscriber } from '@/lib/auth';
import { loadRealTrades } from '@/lib/stats';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Extrato' };
const brl = (v: number) => `${v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Extrato imprimível: use "Imprimir → Salvar como PDF". Uma linha por operação, com o ID da ordem, para conferir com as notas da corretora. */
export default async function Page() {
  const { user, admin, isOwner } = await requireSubscriber();
  const { trades, excluded } = await loadRealTrades(admin, { userId: user.id, includeB3: isOwner });
  const s = computeStats(trades);
  const rows = [...trades].sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  return (
    <div className="bg-white p-6 text-[12px] text-black print:p-0" style={{ colorScheme: 'light' }}>
      <div className="mb-3 flex items-center justify-between print:hidden"><h1 className="text-lg font-semibold">Extrato de operações reais</h1><PrintButton /></div>
      <p className="mb-2">Gerado em {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {s.n} operações · resultado líquido <b>{brl(s.net)}</b> · custos {brl(-s.costs)}{excluded ? ` · ${excluded} operação(ões) sem ID de ordem não contadas` : ''}</p>
      <table className="w-full border-collapse"><thead><tr className="border-b border-black text-left"><th>Saída</th><th>Mercado</th><th>Ativo</th><th>Lado</th><th>ID da ordem</th><th className="text-right">Custos</th><th className="text-right">Líquido</th></tr></thead>
        <tbody>{rows.map((t) => <tr key={t.id} className="border-b border-neutral-300"><td>{new Date(t.closedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{t.market === 'b3' ? 'B3' : 'Cripto'}</td><td>{t.symbol}</td><td>{t.side === 'buy' ? 'compra' : 'venda'}</td><td className="font-mono">{t.orderId}</td><td className="text-right">{brl(-t.fees)}</td><td className="text-right">{brl(t.pnl)}</td></tr>)}</tbody></table>
      <p className="mt-4 text-[10px]">Operações em renda variável podem gerar perdas. Resultados passados não garantem resultados futuros. Este extrato é um controle do app; a nota oficial é a da corretora.</p>
    </div>
  );
}
