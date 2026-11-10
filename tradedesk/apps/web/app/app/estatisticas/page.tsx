import Estatisticas from './Estatisticas';

export const metadata = { title: 'Estatísticas' };

export default function Page() {
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Estatísticas</h1><Estatisticas /></div>);
}
