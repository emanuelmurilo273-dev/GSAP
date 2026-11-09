'use client';
import { useState } from 'react';

/** Glossário em português simples. Qualquer palavra difícil ganha um "?" que explica ao toque/clique. */
export const GLOSSARY: Record<string, { t: string; d: string }> = {
  expectativa: { t: 'Expectativa por operação', d: 'Quanto, em média, o robô ganha (ou perde) a cada operação, já descontando tudo. Se for negativa, o robô perde dinheiro no longo prazo, mesmo que ganhe algumas vezes.' },
  fator: { t: 'Fator de lucro', d: 'Tudo que ganhou dividido por tudo que perdeu. Acima de 1 lucra; abaixo de 1 perde. 1,3 é um bom número; 0,9 é prejuízo.' },
  stop: { t: 'Stop', d: 'Ordem de segurança: se o preço andar contra, a posição é fechada sozinha para a perda não crescer. Fica gravada na corretora.' },
  alvo: { t: 'Alvo', d: 'O preço em que o robô realiza o lucro e fecha a operação.' },
  atr: { t: 'ATR', d: 'Mede o quanto o preço costuma se mexer num candle. Um stop menor que isso é derrubado só pelo balanço normal do mercado.' },
  regime: { t: 'Regime', d: 'O "clima" do mercado: tendência (anda numa direção), lateral (vai e volta) ou agitado demais.' },
  slippage: { t: 'Derrapagem (slippage)', d: 'Diferença entre o preço que o robô queria e o preço em que a ordem de fato executou.' },
  emolumentos: { t: 'Custos', d: 'Taxas da bolsa e da corretora cobradas em cada operação. Pequenas uma a uma, mas somam.' },
  mini: { t: 'Mini índice (WIN) e mini dólar (WDO)', d: 'Contratos pequenos da B3: o WIN acompanha o Ibovespa, o WDO acompanha o dólar.' },
  simulador: { t: 'Simulador', d: 'Dinheiro de mentira. Serve para testar sem risco. No simulador interno os preços são inventados.' },
  drawdown: { t: 'Perda máxima', d: 'A maior queda do resultado, do ponto mais alto até o mais baixo.' },
  ic: { t: 'Margem de erro', d: 'Faixa onde o valor verdadeiro provavelmente está. Se a faixa inclui o zero, ainda não dá para afirmar se há lucro ou prejuízo.' },
  vantagem: { t: 'Vantagem', d: 'Ter vantagem é ganhar, em média, mais do que perde depois de todos os custos. Sem vantagem, operar mais só gasta dinheiro em taxas.' },
  acerto: { t: 'Taxa de acerto', d: 'De cada 100 operações, quantas terminaram no lucro. Acertar muito não basta: o tamanho do ganho e da perda também contam.' },
  trava: { t: 'Trava do modo real', d: 'Cadeado que impede o robô de usar dinheiro de verdade até você aprovar o diagnóstico.' },
};

export function Help({ term }: { term: keyof typeof GLOSSARY | string }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[term];
  if (!g) return null;
  return (
    <span className="relative inline-block align-middle">
      <button type="button" aria-label={`O que é ${g.t}?`} aria-expanded={open} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-bold leading-none text-dim transition hover:border-executor hover:text-executor">?</button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0e141b] p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-2xl">
          <b className="mb-1 block text-executor">{g.t}</b>{g.d}
        </span>)}
    </span>
  );
}
