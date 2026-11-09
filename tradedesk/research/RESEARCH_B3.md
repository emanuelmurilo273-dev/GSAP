# Pesquisa das camadas de inteligência — relatório

Conjunto de dados: **proxy_cripto**. **ATENÇÃO: é um PROXY de cripto (BTC/ETH/SOL, 15m, 3 anos), NÃO são dados da B3.** Serve para validar a máquina de avaliação; as conclusões NÃO se transferem para WIN/WDO.

Protocolo: 60% treino · 20% validação · 20% teste final (uma única vez, com trava). Sinal de base = cruzamento EMA9×EMA21 com stop 0,4% e alvo 1,5×; sessões 12:05–20:00 UTC, zeragem 20:30 UTC. Custos escalados para a proporção custo/stop da B3 (≈ 8% do stop). Aceite: superar a versão atual em fator de lucro, drawdown e Sharpe, com PF > 1 e ≥ 100 operações. **Regra de consistência (acrescentada depois desta rodada):** a camada não pode ter PF pior que a base em treino nem em validação.

| Versão | Trecho | Operações | PF | Drawdown | Sharpe | Acerto |
|---|---|---|---|---|---|---|
| base (sem camadas) | train | 2721 | 0.85 | 1.051 | -2.30 | 40% |
| base (sem camadas) | val | 849 | 0.78 | 0.478 | -3.61 | 39% |
| regime | train | 483 | 0.77 | 0.298 | -2.56 | 37% |
| regime | val | 161 | 0.51 | 0.236 | -5.29 | 29% |
| noticias | train | 2456 | 0.83 | 1.055 | -2.52 | 39% |
| noticias | val | 743 | 0.81 | 0.363 | -3.05 | 40% |
| risco_adaptativo | train | 2721 | 0.85 | 0.757 | -2.16 | 40% |
| risco_adaptativo | val | 849 | 0.72 | 0.454 | -4.41 | 39% |
| ml | val_margem_0.0 | 506 | 0.80 | 0.317 | -2.62 | 40% |
| ml | val_margem_0.03 | 413 | 0.82 | 0.254 | -2.07 | 41% |
| ml | val_margem_0.06 | 316 | 0.78 | 0.217 | -2.44 | 40% |
| base (sem camadas) | **TESTE** | 830 | 0.90 | 0.208 | -1.34 | 42% |
| regime | **TESTE** | 156 | 1.12 | 0.040 | 1.01 | 46% |
| noticias | **TESTE** | 740 | 0.89 | 0.218 | -1.41 | 42% |
| risco_adaptativo | **TESTE** | 830 | 0.91 | 0.151 | -1.27 | 42% |
| ml | **TESTE** | 363 | 0.96 | 0.106 | -0.48 | 44% |

## Veredito por camada

| Camada | Regra formal (só o teste) | Consistente em treino e validação? | Decisão |
|---|---|---|---|
| regime | passou | não | **NÃO adotar** |
| noticias | reprovou | não | **NÃO adotar** |
| risco_adaptativo | reprovou | não | **NÃO adotar** |
| ml | reprovou | n/a (modelo sem série de treino/validação comparável) | **NÃO adotar** |

Fluxo de ordens: não avaliável: exige ticks e book gravados.

## Leitura honesta

- A versão de base **perde dinheiro** neste proxy (PF < 1 em todos os trechos). Melhorar um resultado negativo operando menos não é lucro.
- Uma camada pode passar na regra formal por **sorte** num único trecho (poucas operações). Por isso a regra de consistência: se ela foi pior no treino e na validação, o teste favorável não é confiável.
- **Nada aqui prova que as camadas ajudam na B3.** Rode o mesmo protocolo nos SEUS dados: `python research_b3/evaluate.py csv PASTA select` e depois `test` (uma vez).
- Por isso todas as camadas continuam **DESLIGADAS** na versão campeã inicial.
