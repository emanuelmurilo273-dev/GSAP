// Uma cor por agente, usada de forma consistente em todo o app.
export const AGENTS = [
  { id: 'scout', n: 1, name: 'Scout', color: '#4da3ff', short: 'Coleta candles ao vivo', desc: 'Monitora seus pares e coleta candles em tempo real.' },
  { id: 'filter', n: 2, name: 'Filter', color: '#ffa94d', short: 'Corta par ruim', desc: 'Descarta pares com pouca liquidez, spread alto ou volatilidade extrema.' },
  { id: 'analyst', n: 3, name: 'Analyst', color: '#a478ff', short: 'Nota de 0 a 1', desc: 'EMA 9/21, RSI, MACD, volume e suporte/resistência + resumo por LLM.' },
  { id: 'executor', n: 4, name: 'Executor', color: '#3ddc84', short: 'Ordem real na sua conta', desc: 'Envia a ordem real à sua corretora, limitada a % do seu saldo.' },
  { id: 'risk', n: 5, name: 'Risk', color: '#ff5c9a', short: 'Stop, alvo, limite diário', desc: 'Stop em toda ordem, alvo/trailing e limite de perda diária. Nunca faz preço médio.' },
  { id: 'logger', n: 6, name: 'Logger', color: '#2dd4bf', short: 'Registra tudo', desc: 'Registra entradas, saídas, recusas e motivos. Relatório diário por e-mail.' },
] as const;
