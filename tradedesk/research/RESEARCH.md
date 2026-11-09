# Pesquisa de estratégia — relatório

Gerado em 2026-11-09. Scripts: `research/download.ts`, `engine.ts`, `strategies.ts`, `run.ts`, `report.ts`.

## Veredito

**NENHUMA estratégia passou nos critérios. Nada foi forçado, nenhum parâmetro foi reajustado depois de ver o teste, e o modo real para clientes permanece BLOQUEADO.**

## Método

- **Dados:** BTC, ETH e SOL × USDT, candles reais de `data-api.binance.vision`, 3 anos (2023-11-10 → 2026-11-09), 15m baixado e reamostrado para 1h e 4h (só candles completos).
- **Divisão por tempo (mesmas datas nos 3 timeframes):** 60% treino · 20% validação · 20% teste final. Na fase de seleção o teste final **é removido da memória** (o script só carrega dados até o fim da validação).
- **Walk-forward (dentro do treino):** otimiza em 9 meses, testa nos 3 seguintes, avança 3 meses.
- **Seleção:** por (família, timeframe), os 3 melhores parâmetros do treino vão para a validação; vence o melhor na validação. Por família, escolhe-se o timeframe de melhor validação → 5 finalistas. Só então roda o teste final, **uma vez por finalista** (arquivo `results/test.lock.json` impede repetição).
- **Objetivo de otimização:** fator de lucro (limitado a 3) × √(trades/30), exigindo ≥10 trades.
- **Custos:** taxa 0,1% + slippage 0,05% por execução, sempre. Entrada na abertura do candle seguinte ao sinal; se stop e alvo caem no mesmo candle, vale o stop.
- **Simulação:** long-only spot, 1 posição por par, 100% do capital do par por trade (a "força do sinal" não é mascarada por tamanho pequeno; a família 5 dimensiona por ATR arriscando 1%/trade). Portfólio = 3 pares com peso igual.
- **Orçamento de tentativas:** 204 combinações de parâmetros avaliadas no treino (5 famílias × 3 timeframes). Quanto mais se tenta, maior a chance de um acerto casual — por isso há validação e teste separados.
- **Critérios de aprovação (teste final):** fator de lucro ≥ 1,3 · drawdown máx. do portfólio ≤ 20% · ≥ 100 trades · lucro em ≥ 2 dos 3 pares · Sharpe do portfólio > Sharpe do comprar-e-segurar no mesmo período.

## 1. Teste final (uma única execução por estratégia)

Período: 2026-04-04 → 2026-11-09 (≈ 20% mais recente dos dados).

| Estratégia | TF | Parâmetros | PF | DD máx. | Trades | Pares c/ lucro | Sharpe | Retorno | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| Tendência (EMA cross + ADX) | 15m | `{"fast":20,"slow":50,"adxMin":25,"stop":0.04}` | 0.76 | 32.1% | 369 | 0/3 | -1.41 | -25.5% | reprovada |
| Rompimento (Donchian) | 1h | `{"nIn":80,"nOut":20,"stop":0.04}` | 0.89 | 18.9% | 82 | 0/3 | -0.43 | -8.3% | reprovada |
| Reversão à média (RSI + Bollinger) | 4h | `{"rsiMax":25,"k":2,"stop":0.06}` | 1.00 | 8.9% | 15 | 1/3 | 0.01 | -0.2% | reprovada |
| Momentum + regime (SMA200) | 15m | `{"look":20,"thr":0.03,"stop":0.04}` | 0.74 | 10.6% | 97 | 2/3 | -0.81 | -6.5% | reprovada |
| Rompimento + regime + ATR (stop e tamanho) | 1h | `{"nIn":55,"kStop":3,"mTrail":3}` | 0.81 | 10.7% | 111 | 1/3 | 0.14 | 0.5% | reprovada |

Referência — comprar e segurar (portfólio igual-peso, mesmo período): retorno 8.4%, DD 33.5%, Sharpe 0.52.

### Critérios, estratégia a estratégia

| Estratégia | PF ≥ 1,3 | DD ≤ 20% | ≥ 100 trades | ≥ 2 pares c/ lucro | Sharpe > B&H |
|---|---|---|---|---|---|
| Tendência (EMA cross + ADX) @15m | ❌ 0.76 | ❌ 32.1% | ✅ 369 | ❌ 0/3 | ❌ -1.41 vs 0.52 |
| Rompimento (Donchian) @1h | ❌ 0.89 | ✅ 18.9% | ❌ 82 | ❌ 0/3 | ❌ -0.43 vs 0.53 |
| Reversão à média (RSI + Bollinger) @4h | ❌ 1.00 | ✅ 8.9% | ❌ 15 | ❌ 1/3 | ❌ 0.01 vs 0.52 |
| Momentum + regime (SMA200) @15m | ❌ 0.74 | ✅ 10.6% | ❌ 97 | ✅ 2/3 | ❌ -0.81 vs 0.52 |
| Rompimento + regime + ATR (stop e tamanho) @1h | ❌ 0.81 | ✅ 10.7% | ✅ 111 | ❌ 1/3 | ❌ 0.14 vs 0.53 |

### Por par (teste final)

| Estratégia | BTC | ETH | SOL |
|---|---|---|---|
| Tendência (EMA cross + ADX) @15m | -16.5% | -29.0% | -31.1% |
| Rompimento (Donchian) @1h | -4.2% | -16.6% | -4.1% |
| Reversão à média (RSI + Bollinger) @4h | -6.1% | 9.0% | -3.6% |
| Momentum + regime (SMA200) @15m | 2.7% | 0.5% | -22.7% |
| Rompimento + regime + ATR (stop e tamanho) @1h | -4.7% | 6.3% | -0.0% |

## 2. Validação (20% do meio) — todas as 15 combinações

| Família | TF | Parâmetros escolhidos no treino | Treino PF | Validação PF | Val. trades | Val. retorno | Val. DD | Walk-forward PF (OOS) | WF trades | WF folds lucrativos |
|---|---|---|---|---|---|---|---|---|---|---|
| Tendência (EMA cross + ADX) | 15m | `{"fast":20,"slow":50,"adxMin":25,"stop":0.04}` | 0.97 | 0.60 | 384 | -44.1% | 46.3% | 0.94 | 641 | 2/4 |
| Rompimento (Donchian) | 15m | `{"nIn":40,"nOut":20,"stop":0.04}` | 0.85 | 0.58 | 510 | -49.6% | 50.0% | 0.79 | 1044 | 0/4 |
| Reversão à média (RSI + Bollinger) | 15m | `{"rsiMax":25,"k":2,"stop":0.03}` | 0.69 | 0.56 | 291 | -35.1% | 37.5% | 0.65 | 853 | 0/4 |
| Momentum + regime (SMA200) | 15m | `{"look":20,"thr":0.03,"stop":0.04}` | 0.80 | 0.57 | 164 | -19.6% | 24.4% | 0.81 | 443 | 2/4 |
| Rompimento + regime + ATR (stop e tamanho) | 15m | `{"nIn":20,"kStop":3,"mTrail":4}` | 0.78 | 0.54 | 543 | -42.5% | 43.1% | 0.76 | 901 | 0/4 |
| Tendência (EMA cross + ADX) | 1h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 1.15 | 0.47 | 120 | -34.0% | 39.9% | 0.98 | 196 | 2/4 |
| Rompimento (Donchian) | 1h | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.22 | 0.59 | 75 | -15.0% | 22.8% | 1.17 | 152 | 3/4 |
| Reversão à média (RSI + Bollinger) | 1h | `{"rsiMax":35,"k":2,"stop":0.03}` | 0.76 | 0.61 | 312 | -44.5% | 47.0% | 0.50 | 191 | 0/4 |
| Momentum + regime (SMA200) | 1h | `{"look":40,"thr":0.03,"stop":0.04}` | 1.05 | 0.55 | 128 | -21.2% | 28.6% | 0.99 | 262 | 1/4 |
| Rompimento + regime + ATR (stop e tamanho) | 1h | `{"nIn":55,"kStop":3,"mTrail":3}` | 1.15 | 0.57 | 94 | -5.6% | 7.5% | 1.08 | 215 | 3/4 |
| Tendência (EMA cross + ADX) | 4h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 1.93 | 0.16 | 40 | -26.2% | 32.4% | 1.43 | 69 | 2/4 |
| Rompimento (Donchian) | 4h | `{"nIn":40,"nOut":20,"stop":0.04}` | 2.19 | 0.32 | 28 | -16.4% | 24.7% | 1.81 | 65 | 4/4 |
| Reversão à média (RSI + Bollinger) | 4h | `{"rsiMax":25,"k":2,"stop":0.06}` | 1.33 | 0.93 | 38 | -4.1% | 19.2% | 1.33 | 43 | 3/4 |
| Momentum + regime (SMA200) | 4h | `{"look":40,"thr":0.03,"stop":0.08}` | 1.76 | 0.46 | 37 | -12.3% | 23.5% | 1.46 | 128 | 3/4 |
| Rompimento + regime + ATR (stop e tamanho) | 4h | `{"nIn":55,"kStop":2,"mTrail":3}` | 2.35 | 0.44 | 21 | -1.5% | 5.3% | 1.95 | 63 | 4/4 |

## 3. Os 3 melhores do treino de cada combinação (e como foram na validação)

| Família | TF | Parâmetros | Treino PF | Treino trades | Validação PF | Val. trades |
|---|---|---|---|---|---|---|
| trend | 15m | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 1.00 | 1095 | 0.60 | 384 |
| trend | 15m | `{"fast":20,"slow":50,"adxMin":25,"stop":0.04}` | 0.97 | 1107 | 0.60 | 384 |
| trend | 15m | `{"fast":12,"slow":50,"adxMin":25,"stop":0.08}` | 0.97 | 1234 | 0.56 | 437 |
| breakout | 15m | `{"nIn":40,"nOut":20,"stop":0.08}` | 0.86 | 1576 | 0.58 | 510 |
| breakout | 15m | `{"nIn":40,"nOut":20,"stop":0.04}` | 0.85 | 1579 | 0.58 | 510 |
| breakout | 15m | `{"nIn":20,"nOut":20,"stop":0.08}` | 0.82 | 2168 | 0.57 | 723 |
| meanrev | 15m | `{"rsiMax":25,"k":2,"stop":0.06}` | 0.71 | 671 | 0.53 | 268 |
| meanrev | 15m | `{"rsiMax":25,"k":2.5,"stop":0.06}` | 0.70 | 512 | 0.56 | 207 |
| meanrev | 15m | `{"rsiMax":25,"k":2,"stop":0.03}` | 0.69 | 735 | 0.56 | 291 |
| momentum | 15m | `{"look":40,"thr":0.03,"stop":0.08}` | 0.87 | 806 | 0.48 | 211 |
| momentum | 15m | `{"look":40,"thr":0.03,"stop":0.04}` | 0.86 | 808 | 0.48 | 211 |
| momentum | 15m | `{"look":20,"thr":0.03,"stop":0.04}` | 0.80 | 664 | 0.57 | 164 |
| atrcombo | 15m | `{"nIn":20,"kStop":3,"mTrail":4}` | 0.78 | 1716 | 0.54 | 543 |
| atrcombo | 15m | `{"nIn":55,"kStop":3,"mTrail":4}` | 0.77 | 1281 | 0.52 | 387 |
| atrcombo | 15m | `{"nIn":55,"kStop":3,"mTrail":3}` | 0.75 | 1419 | 0.52 | 422 |
| trend | 1h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.08}` | 1.18 | 375 | 0.44 | 119 |
| trend | 1h | `{"fast":20,"slow":26,"adxMin":25,"stop":0.08}` | 1.16 | 369 | 0.46 | 118 |
| trend | 1h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 1.15 | 395 | 0.47 | 120 |
| breakout | 1h | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.22 | 275 | 0.59 | 75 |
| breakout | 1h | `{"nIn":80,"nOut":20,"stop":0.08}` | 1.17 | 269 | 0.58 | 74 |
| breakout | 1h | `{"nIn":80,"nOut":10,"stop":0.04}` | 1.15 | 346 | 0.47 | 94 |
| meanrev | 1h | `{"rsiMax":35,"k":2,"stop":0.06}` | 0.77 | 656 | 0.54 | 253 |
| meanrev | 1h | `{"rsiMax":35,"k":2.5,"stop":0.03}` | 0.77 | 558 | 0.52 | 208 |
| meanrev | 1h | `{"rsiMax":35,"k":2,"stop":0.03}` | 0.76 | 800 | 0.61 | 312 |
| momentum | 1h | `{"look":40,"thr":0.03,"stop":0.08}` | 1.08 | 446 | 0.54 | 126 |
| momentum | 1h | `{"look":40,"thr":0.03,"stop":0.04}` | 1.05 | 458 | 0.55 | 128 |
| momentum | 1h | `{"look":10,"thr":0.03,"stop":0.08}` | 0.99 | 481 | 0.44 | 117 |
| atrcombo | 1h | `{"nIn":55,"kStop":2,"mTrail":3}` | 1.24 | 362 | 0.51 | 103 |
| atrcombo | 1h | `{"nIn":55,"kStop":2,"mTrail":4}` | 1.20 | 330 | 0.34 | 101 |
| atrcombo | 1h | `{"nIn":55,"kStop":3,"mTrail":3}` | 1.15 | 339 | 0.57 | 94 |
| trend | 4h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 1.93 | 106 | 0.16 | 40 |
| trend | 4h | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 1.85 | 81 | 0.11 | 22 |
| trend | 4h | `{"fast":20,"slow":50,"adxMin":20,"stop":0.08}` | 1.81 | 95 | 0.11 | 34 |
| breakout | 4h | `{"nIn":40,"nOut":20,"stop":0.04}` | 2.19 | 103 | 0.32 | 28 |
| breakout | 4h | `{"nIn":40,"nOut":20,"stop":0.08}` | 1.97 | 94 | 0.20 | 28 |
| breakout | 4h | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.84 | 81 | 0.29 | 17 |
| meanrev | 4h | `{"rsiMax":25,"k":2.5,"stop":0.06}` | 1.53 | 38 | 0.68 | 23 |
| meanrev | 4h | `{"rsiMax":25,"k":2,"stop":0.06}` | 1.33 | 65 | 0.93 | 38 |
| meanrev | 4h | `{"rsiMax":30,"k":2.5,"stop":0.06}` | 1.27 | 80 | 0.66 | 38 |
| momentum | 4h | `{"look":40,"thr":0.03,"stop":0.04}` | 1.82 | 172 | 0.39 | 41 |
| momentum | 4h | `{"look":40,"thr":0,"stop":0.04}` | 1.76 | 274 | 0.43 | 67 |
| momentum | 4h | `{"look":40,"thr":0.03,"stop":0.08}` | 1.76 | 164 | 0.46 | 37 |
| atrcombo | 4h | `{"nIn":55,"kStop":2,"mTrail":3}` | 2.35 | 82 | 0.44 | 21 |
| atrcombo | 4h | `{"nIn":55,"kStop":2,"mTrail":4}` | 2.18 | 78 | 0.26 | 21 |
| atrcombo | 4h | `{"nIn":55,"kStop":3,"mTrail":3}` | 2.17 | 75 | 0.33 | 21 |

## 4. Folds do walk-forward (treino)

**Tendência (EMA cross + ADX) @15m**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 0.90 | 152 | -7.3% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"fast":12,"slow":50,"adxMin":25,"stop":0.08}` | 0.67 | 179 | -21.1% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 1.13 | 159 | 3.3% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 1.17 | 151 | 6.5% |

**Rompimento (Donchian) @15m**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":40,"nOut":20,"stop":0.08}` | 0.70 | 224 | -20.4% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":40,"nOut":20,"stop":0.08}` | 0.64 | 236 | -28.9% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":20,"nOut":20,"stop":0.08}` | 1.00 | 285 | -4.5% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":20,"nOut":20,"stop":0.08}` | 0.80 | 299 | -15.1% |

**Reversão à média (RSI + Bollinger) @15m**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"rsiMax":35,"k":2,"stop":0.03}` | 0.66 | 343 | -19.0% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"rsiMax":35,"k":2,"stop":0.03}` | 0.64 | 386 | -33.1% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"rsiMax":25,"k":2.5,"stop":0.06}` | 0.64 | 75 | -9.0% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"rsiMax":25,"k":2.5,"stop":0.06}` | 0.76 | 49 | -2.4% |

**Momentum + regime (SMA200) @15m**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"look":40,"thr":0.03,"stop":0.08}` | 1.08 | 80 | 0.8% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"look":40,"thr":0.03,"stop":0.08}` | 0.57 | 154 | -20.0% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"look":40,"thr":0.03,"stop":0.08}` | 1.13 | 113 | 3.3% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"look":40,"thr":0.03,"stop":0.08}` | 0.65 | 96 | -10.8% |

**Rompimento + regime + ATR (stop e tamanho) @15m**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":55,"kStop":3,"mTrail":4}` | 0.65 | 190 | -16.0% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":20,"kStop":3,"mTrail":4}` | 0.65 | 247 | -17.9% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":20,"kStop":3,"mTrail":4}` | 0.94 | 222 | -4.1% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":20,"kStop":3,"mTrail":4}` | 0.81 | 242 | -8.2% |

**Tendência (EMA cross + ADX) @1h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 2.01 | 40 | 18.6% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"fast":20,"slow":50,"adxMin":25,"stop":0.08}` | 0.58 | 45 | -18.5% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 0.85 | 59 | -9.3% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"fast":12,"slow":50,"adxMin":25,"stop":0.04}` | 1.11 | 52 | 2.3% |

**Rompimento (Donchian) @1h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.95 | 38 | 15.0% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":80,"nOut":20,"stop":0.08}` | 1.13 | 34 | 1.8% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":80,"nOut":20,"stop":0.08}` | 0.85 | 40 | -7.4% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.12 | 40 | 1.2% |

**Reversão à média (RSI + Bollinger) @1h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"rsiMax":25,"k":2.5,"stop":0.03}` | 0.22 | 17 | -7.4% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"rsiMax":25,"k":2.5,"stop":0.03}` | 0.42 | 23 | -10.6% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"rsiMax":35,"k":2.5,"stop":0.06}` | 0.50 | 72 | -21.7% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"rsiMax":35,"k":2,"stop":0.06}` | 0.68 | 79 | -7.6% |

**Momentum + regime (SMA200) @1h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"look":40,"thr":0.03,"stop":0.08}` | 2.17 | 55 | 19.0% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"look":40,"thr":0.03,"stop":0.08}` | 0.69 | 76 | -14.0% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"look":40,"thr":0.03,"stop":0.04}` | 0.93 | 67 | -5.8% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"look":40,"thr":0.03,"stop":0.04}` | 0.85 | 64 | -5.5% |

**Rompimento + regime + ATR (stop e tamanho) @1h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":55,"kStop":2,"mTrail":3}` | 2.27 | 47 | 5.8% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":55,"kStop":2,"mTrail":3}` | 0.89 | 48 | 0.4% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":55,"kStop":2,"mTrail":3}` | 0.94 | 54 | 0.9% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":55,"kStop":2,"mTrail":3}` | 0.84 | 66 | -2.5% |

**Tendência (EMA cross + ADX) @4h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"fast":20,"slow":50,"adxMin":20,"stop":0.08}` | 0.94 | 17 | -1.8% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"fast":9,"slow":26,"adxMin":20,"stop":0.08}` | 0.79 | 21 | -4.2% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 2.12 | 14 | 11.8% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"fast":20,"slow":50,"adxMin":20,"stop":0.04}` | 2.38 | 17 | 12.7% |

**Rompimento (Donchian) @4h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":20,"nOut":20,"stop":0.08}` | 1.65 | 21 | 8.9% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":80,"nOut":20,"stop":0.04}` | 1.51 | 13 | 4.3% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":40,"nOut":20,"stop":0.04}` | 3.99 | 12 | 16.9% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":40,"nOut":20,"stop":0.04}` | 1.34 | 19 | 3.5% |

**Reversão à média (RSI + Bollinger) @4h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"rsiMax":30,"k":2.5,"stop":0.06}` | 1.21 | 8 | 0.8% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"rsiMax":30,"k":2.5,"stop":0.06}` | 1.60 | 17 | 7.8% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"rsiMax":25,"k":2.5,"stop":0.06}` | 1.04 | 13 | -0.9% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"rsiMax":25,"k":2,"stop":0.06}` | 2.23 | 5 | 2.6% |

**Momentum + regime (SMA200) @4h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"look":40,"thr":0.03,"stop":0.08}` | 1.66 | 17 | 6.4% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"look":40,"thr":0.03,"stop":0.04}` | 0.90 | 27 | -2.0% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"look":40,"thr":0.03,"stop":0.04}` | 2.50 | 20 | 13.8% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"look":40,"thr":0,"stop":0.04}` | 1.39 | 64 | 6.5% |

**Rompimento + regime + ATR (stop e tamanho) @4h**

| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |
|---|---|---|---|---|---|
| 2023-11-10 | 2024-08-10 → 2024-11-09 | `{"nIn":55,"kStop":2,"mTrail":4}` | 2.31 | 13 | 1.9% |
| 2024-02-09 | 2024-11-09 → 2025-02-08 | `{"nIn":55,"kStop":2,"mTrail":4}` | 1.82 | 13 | 1.8% |
| 2024-05-10 | 2025-02-08 → 2025-05-11 | `{"nIn":55,"kStop":2,"mTrail":3}` | 12.54 | 7 | 5.8% |
| 2024-08-10 | 2025-05-11 → 2025-08-10 | `{"nIn":20,"kStop":2,"mTrail":3}` | 1.03 | 30 | 1.7% |

## Leitura honesta dos números

- Na **validação**, as 15 combinações deram prejuízo (fator de lucro entre 0,16 e 0,93). No **teste final**, as 5 finalistas também (PF 0,74–1,00) e todas ficaram com Sharpe abaixo do comprar-e-segurar.
- O walk-forward do treino mostrou PFs acima de 1 em alguns casos (especialmente 4h, com poucos trades). Esse ganho **não se repetiu** fora da amostra: é o padrão típico de ajuste ao passado.
- Os períodos de validação e teste foram, em boa parte, de queda/lateralização do mercado cripto; estratégias só-compradas sofrem nesses regimes. Isso explica, mas **não justifica**, aprovar algo: o critério era robustez fora da amostra.
- Limitações: 3 anos é pouco para estratégias de tendência (poucos ciclos); 4h gera poucos trades (a exigência de ≥100 trades é difícil de cumprir nesse timeframe em ~7 meses de teste); grades de parâmetros pequenas; sem short, sem derivativos; execução idealizada (sem fila/liquidez real).
- **Não** foram feitas rodadas extras de ajuste após ver o teste final, e **não** é válido repetir o teste com outros parâmetros: o teste final desta rodada já está consumido. Para uma nova pesquisa seria preciso novos dados (período posterior) como novo teste final.

## Consequência para o produto

- Nenhuma estratégia aprovada ⇒ `STRATEGY_APPROVED=false`: **clientes não conseguem ligar o robô em conta real**. O robô continua disponível em testnet e na "conta do dono" (validação com valor pequeno), com aviso explícito. A estratégia padrão atual do app (nota técnica) **não** foi aprovada: seu backtest real foi negativo (ver README).


## Camadas de inteligência da B3 (registro)

O estudo acima é do cripto (legado). As camadas novas do robô da B3 (regime, fluxo, notícias, LightGBM, risco adaptativo) foram avaliadas em [`RESEARCH_B3.md`](RESEARCH_B3.md): **nenhuma foi adotada**. O regime passou no teste final, mas contrariou treino e validação (regra de consistência) → desligado; notícias, risco adaptativo e ML foram reprovados; o fluxo não pôde ser avaliado por falta de ticks/livro gravados da B3. Todas permanecem desligadas até passarem no protocolo com dados reais da B3.
