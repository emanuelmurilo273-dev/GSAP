import { Panel, dateOnly, num } from '@/components/ui';
import { redirect } from 'next/navigation';
import { requireSubscriber } from '@/lib/auth';
import CancelButton from './CancelButton';

export default async function Page() {
  const { user, sub, admin, isOwner } = await requireSubscriber();
  if (isOwner) redirect('/admin'); // o dono não tem assinatura
  const { data: pays } = await admin.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(24);
  return (
    <div className="space-y-4">
      <h1 className="text-lg text-neon-pink">&gt; assinatura</h1>
      <Panel title="plano" accent="#ff4fa3">
        <div className="space-y-1 text-sm">
          <p>Status: <b className={sub.status === 'active' ? 'text-neon-green' : 'text-neon-orange'}>{sub.status}</b> · valor R$ {num(+sub.value)}/mês</p>
          {sub.paid_until && <p className="text-dim">Pago até {dateOnly(sub.paid_until)}</p>}
          {sub.status === 'overdue' && <p className="text-neon-orange">Pagamento vencido. Regularize em até 3 dias para não perder o acesso.</p>}
        </div>
        {sub.status !== 'canceled' && <div className="mt-4"><CancelButton /></div>}
      </Panel>
      <Panel title="pagamentos" accent="#3aa8ff">
        {!pays?.length ? <p className="text-sm text-dim">Nenhum pagamento.</p> : (
          <table className="w-full text-xs"><thead className="text-left text-dim"><tr><th>Vencimento</th><th>Valor</th><th>Status</th><th /></tr></thead>
            <tbody>{pays.map((p) => <tr key={p.asaas_payment_id} className="border-t border-line"><td className="py-1">{p.due_date ? dateOnly(p.due_date + 'T12:00:00Z') : '—'}</td><td>R$ {num(+p.value)}</td><td>{p.status}</td><td>{p.invoice_url && <a href={p.invoice_url} target="_blank" rel="noreferrer">fatura</a>}</td></tr>)}</tbody></table>)}
      </Panel>
    </div>
  );
}
