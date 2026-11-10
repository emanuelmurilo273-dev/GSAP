import Historico from './Historico';

export const metadata = { title: 'Histórico' };

export default function Page() {
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Histórico</h1><p className="text-sm text-dim">Só operações reais executadas na corretora.</p><Historico /></div>);
}
