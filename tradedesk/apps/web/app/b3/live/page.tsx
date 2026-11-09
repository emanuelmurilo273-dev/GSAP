import LiveChart from './LiveChart';

export default function Page() {
  return (<div className="space-y-2"><h1 className="font-display text-xl">Ao vivo</h1>
    <p className="text-xs text-dim">Candles, livro de ofertas e fluxo do contrato atual, direto do conector. Se ficar mais de 5 s sem tick, aparece o alerta vermelho.</p><LiveChart /></div>);
}
