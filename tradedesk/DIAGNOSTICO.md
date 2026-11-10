# 🛑 EMERGÊNCIA — perdas reais (atualização)

**Conclusão em uma frase: o robô NÃO tem vantagem.** Ele perde dinheiro por construção, e não por um bug isolado.

## O que eu consegui medir (e o que não)
- **Não tenho acesso às suas contas nem ao seu banco**, então **não sei o valor exato que você perdeu**. Os números reais saem dos seus dados com as ferramentas já prontas, que só leem e não alteram nada:
  - **Cripto:** `Autopsia-Cripto-Windows.bat` (ou `Autopsia-Cripto-Mac.command`) → gera `DIAGNOSTICO-CRIPTO-SEUS-DADOS.md` com expectativa em R$, custos, recortes (ativo, horário, dia, setup, saída), as 20 piores, comparação com o backtest e auditoria de execução.
  - **B3:** `connector\Autopsia.bat` → `DIAGNOSTICO-SEUS-DADOS.md`.
- **O que dá para afirmar sem os seus dados**, porque vem de dados públicos da Foxbit e do próprio código:
  1. **A estratégia de cripto perde por si só.** Com 2 anos de dados reais da Foxbit e as taxas reais (0,5% por lado), o fator de lucro foi **0,37 a 0,63** e a média por operação **−0,71% a −1,45%**. O prejuízo real que você viu é **coerente com o backtest**: não é overfitting nem azar.
  2. **As taxas consomem o alvo.** Ida e volta custa ~1% (taker) ou ~0,5% (maker) contra um alvo de 6%, e mais a derrapagem dos stops.
  3. **A B3 também não tem vantagem comprovada**: das 5 famílias testadas nenhuma passou na seleção (ver `research/RESEARCH_B3.md`), e as regras antigas operavam demais, com stop dentro do ruído.

## Ações imediatas já no código
- **Chave geral de emergência** (`kill_switch`): liga na migration `010_emergencia.sql`, e o worker de cripto, o conector da B3 e o site **recusam** operar enquanto ela estiver ligada. Botão no `/admin`, e `Parar-Emergencia-Windows.bat` / `Parar-Emergencia-Mac.command` desligam tudo e vendem as posições a mercado.
- Religar só pelo dono, **com estratégia aprovada** e a frase `RELIGAR APÓS APROVAÇÃO`.

---

# DIAGNÓSTICO — por que o robô perde dinheiro

> **Resumo em 5 linhas**
> 1. **Sem vantagem comprovada**: o robô entrava a cada cruzamento de médias (EMA9×EMA21). Num mercado sem vantagem, o resultado esperado é *zero menos os custos* — ou seja, negativo.
> 2. **Custos e stops ruins agravavam**: no simulador (240 pregões) o robô estava em **+R$ 759 sem nenhum custo** e terminou em **−R$ 1.164** depois de corretagem, emolumentos e derrapagem. Os stops fixos (5 pts no mini dólar, 150 no mini índice) eram menores que o balanço normal do preço (ATR ≈ 6 e ≈ 175 pts no simulador): eram derrubados por ruído.
> 3. **Operava demais e nas horas erradas**: 4,5 operações por dia, 76% delas em mercado lateral, 46 nos primeiros 15 min, sem parar depois de perdas seguidas.
> 4. **Depois das correções (v2)** o prejuízo cai muito (de −R$ 4,85 para −R$ 0,36 por pregão no simulador), **mas a vantagem continua NÃO comprovada**. Veredito: **"a estratégia não tem vantagem comprovada" — o modo real continua TRAVADO.**
> 5. **Limite deste estudo**: eu não tenho acesso aos *seus* trades (eles ficam no banco do seu PC). Rode `connector\Autopsia.bat` para gerar o mesmo relatório com os seus dados reais.

## 0. O que foi feito de imediato (proteção)

| Medida | Como |
|---|---|
| Volta ao SIMULADOR | migration `007_b3_protecao_diagnostico.sql` (o instalador aplica) |
| Modo real TRAVADO | coluna `real_locked`; o site recusa liberar e o conector também recusa operar real. Só se destrava na aba *Saúde do robô* digitando `LIBERAR APÓS DIAGNÓSTICO` (e mesmo assim as demais liberações continuam valendo) |
| Perfil Conservador | perda máx. R$ 100/dia, risco R$ 50/operação, 1 contrato, 3 operações/dia, risco/retorno ≥ 1:1,5, abertura a partir de 09:15 |

## 1. O que foi analisado (e o que NÃO foi)

- **Analisado**: o robô de verdade (mesmo `engine.py` do conector) rodado no simulador interno por **4 sementes × 60 pregões = 240 pregões, 1.075 operações** nas regras antigas, com custos e derrapagem realistas (1 tick no stop; emolumentos de **placeholder**: WIN R$ 0,50 / WDO R$ 2,00 por contrato ida e volta — **confirme na Clear**). Também o backtest de candles no mercado-proxy (cripto com custo escalado à B3) e a revisão de código.
- **O simulador interno tem preços INVENTADOS e neutros** (sem tendência embutida). Logo, ele mede o efeito de **custos, stops e regras de execução**, mas **nunca** pode provar que existe (ou não) vantagem no mercado real. Os recortes por horário/dia/regime abaixo, num mercado inventado, são ruído: foram incluídos só para mostrar o método.
- **Não analisado**: as suas operações reais/demo. Elas **não estavam acessíveis** nesta sessão. A ferramenta está pronta (`Autopsia.bat`) e produz exatamente as seções 2–7 com os seus números. O spread (comprar no *ask*, vender no *bid*) já está dentro dos preços executados, não aparece como linha separada.

## 2. As 3 causas principais

1. **Sem vantagem + custos = prejuízo garantido.** Num mercado sem vantagem, um stop com alvo 1,5× acerta ~40% das vezes; é preciso acertar 41,4% (WIN) e **43,8% (WDO)** só para pagar os custos. Resultado esperado só pelo custo: **−R$ 1,08/op no WIN e −R$ 4,79/op no WDO**, sem nenhum erro de execução. Operar muito multiplica esse desgaste.
2. **Stop fixo dentro do ruído.** WDO: stop de 5 pts contra ATR do candle ≈ 6 pts (0,8 ATR). WIN: stop de 150 pts contra ATR ≈ 175 pts (0,9 ATR). 58% das operações terminaram no stop e 41% no alvo. Um stop menor que 1 ATR é derrubado pelo balanço normal do preço.
3. **Excesso e mau momento de operar.** 4,5 operações/dia; 76% das entradas em mercado lateral (onde cruzamento de médias costuma falhar); 46 entradas nos primeiros 15 min; sem regra de parar após perdas seguidas; 14 saídas por limite diário.

## 3. Revisão de código do Executor e do Risk

| # | Achado | Gravidade | Situação |
|---|---|---|---|
| 1 | Desvio máximo de preço das ordens = 20 (entrada) e 30 (saída) **pontos** fixos: no WDO isso permitia derrapar mais de **4× o stop** | alta | **corrigido**: 2 ticks na entrada, 3 na saída (`gateway.py`) |
| 2 | `positions()` devolvia **todas** as posições da conta, inclusive as **manuais**: PARAR TUDO / zeragem de fim de dia / "1 por ativo" poderiam mexer nas suas | alta | **corrigido**: só posições com o *magic number* do robô |
| 3 | Entrava a partir de 09:05 (abertura é leilão/gap/spread largo) | média | **corrigido**: piso de 09:15 no motor (vale mesmo que o painel diga 09:05) |
| 4 | O limite de perda do dia só reagia **depois** de estourado; podia abrir operação cujo stop passaria do limite | média | **corrigido**: a operação só entra se o risco dela (+ o das abertas) couber no que resta do limite |
| 5 | Custos invisíveis: o simulador não cobrava taxa nem derrapagem e a operação não guardava custo/bruto | média | **corrigido**: simulador com custos; colunas `fees`, `gross_pnl`, `price_signal`, `regime`, `atr_pts`, `why` |
| 6 | Sem parar após perdas seguidas; sequência de perdas (`loss_streak`) não zerava a cada dia | média | **corrigido**: contador diário + parada após 2 perdas |
| 7 | Stop fixo em pontos (não olhava a volatilidade) | alta | **corrigido**: stop técnico (≥1×ATR e além da última região), alvo ≥1,5× |
| 8 | `closed_at` é gravado com o relógio do robô na hora em que percebe a saída, não com a hora do negócio | baixa | **aberto** (só afeta medição de duração) |
| 9 | O envio de ordens ao MT5 de verdade **nunca foi executado**: a Clear pode exigir stop/alvo numa 2ª chamada. Se recusar, o robô fica fora do mercado (seguro) e registra erro | desconhecida | **aberto — só se descobre na conta demo** |
| — | Verificado sem problema: stop confirmado no servidor (senão fecha na hora), 1 posição por ativo, ordem rejeitada → pausa de 60 s, PARAR TUDO, dimensionamento arredonda para baixo | — | ok |

Verificações automáticas de integridade no estudo (240 pregões): **sem ticket duplicado, sem ordem duplicada, sem posição esquecida, sem posição sem stop, sem sobreposição, limite diário respeitado**. A única violação das regras novas foi a esperada: 46 entradas antes de 09:15 nas regras antigas.

## 4. Correções aplicadas (só o que o diagnóstico justificou)

- Não opera nos primeiros 15 min, nem 15 min antes/depois de notícia forte (calendário do painel + abertura de Nova York).
- Para o dia depois de **2 perdas seguidas**. Operar menos: só entra se o stop técnico cabe no risco.
- **Stop técnico** (≥1×ATR, além do último fundo/topo com folga) e **alvo ≥ 1,5× o stop**; o tamanho da mão vem do stop (risco constante).
- Proibido (e sem código que faça): martingale, preço médio contra a posição, aumentar a mão para recuperar, tirar o stop. Testado: o tamanho nunca cresce após perda.
- **Cortes por horário/ativo/regime/lado: NENHUM.** Nenhum recorte tem prejuízo *provado* (≥30 operações e margem de erro inteira abaixo de zero). O mecanismo existe (`blocks` na versão campeã) e o relatório só sugere cortes com essa prova.

## 5. Antes × depois (números)

**Simulador interno (mercado inventado e neutro), 4 sementes × 60 pregões, com custos:**

| Versão | Operações | Operações/dia | Resultado | Por pregão | Expectativa/op | Fator de lucro |
|---|---|---|---|---|---|---|
| ANTES (regras antigas) | 1.075 | 4,5 | **−R$ 1.164** | −R$ 4,85 | −R$ 1,08 | 0,95 |
| DEPOIS v2, perfil Conservador (R$ 50/op) | 19 | 0,08 | −R$ 278 | −R$ 1,16 | −R$ 14,66 (margem ±24: sem significado) | 0,56 |
| DEPOIS v2, risco R$ 100/op | 308 | 1,3 | **−R$ 86** | −R$ 0,36 | −R$ 0,28 | 0,99 |

Leitura honesta: (a) o prejuízo por pregão cai 93% quando o robô opera menos e com stop técnico; (b) **no perfil Conservador o robô quase nunca opera** (19 operações em 240 pregões): com R$ 50 de risco o stop técnico quase nunca cabe — e com tão poucas operações **levaria anos para provar algo**; (c) em mercado inventado não existe vantagem a achar, então "menos prejuízo" é o máximo que se pode esperar aqui.

**Mercado-proxy (candles de cripto, custo na mesma proporção da B3) — estrutura das regras definida antes dos números, nada ajustado** (ver ressalva: o trecho "teste" já foi usado na pesquisa das camadas, então isto é *descritivo*, não prova):

| Variante | Trecho | Operações | Fator de lucro | Resultado (fração da conta·unidade) | Perda máx. |
|---|---|---|---|---|---|
| antes | treino / validação / teste | 2.721 / 849 / 830 | 0,85 / 0,78 / 0,90 | −1,00 / −0,47 / −0,18 | 1,05 / 0,48 / 0,21 |
| v2 completo | treino / validação / teste | 1.031 / 349 / 492 | 1,05 / 0,95 / **0,85** | +0,09 / −0,03 / −0,12 | 0,15 / 0,13 / 0,17 |

O stop técnico + parada diária encolhem o prejuízo e a perda máxima (de 1,05 para 0,15 no treino), mas **o fator de lucro fora da amostra continua abaixo de 1 (0,85)**.

**Backtest × simulador × real:** backtest-proxy PF 0,78–0,90 · simulador PF 0,95 · **real: sem dados nesta sessão** (rode `Autopsia.bat`). Se o real vier bem pior que o backtest, a ferramenta já checa: derrapagem (medida contra `price_signal`), ordens duplicadas, stop ausente, posição esquecida, entradas proibidas e estouro de limite. O único fator que eu **não** consigo verificar daqui é a execução real na Clear (item 9 da seção 3).

## 6. Veredito

> ### SEM VANTAGEM COMPROVADA — "a estratégia não tem vantagem".
> Fora da amostra, o fator de lucro é **0,85 (proxy)** e **0,87 (simulador, regras antigas)**; nenhuma versão tem 100+ operações fora da amostra com margem de erro acima de zero. As correções reduzem o dano, **não criam lucro**.
> **O modo real permanece TRAVADO.** Não é seguro voltar ao real.

Para um dia merecer o real: ≥ 100 operações na **conta demo do MT5** (preços reais) com as regras v2, aba *Saúde do robô* **verde** (expectativa > 0 com margem de erro acima de zero), execução validada na Clear — e só então destravar. Se nunca ficar verde, a conclusão é que a estratégia de cruzamento de médias não serve, e o próximo passo é pesquisar outra (com dados reais da B3).

---

# Anexo — relatórios gerados pela ferramenta (`research_b3/autopsia.py`)

## Simulador — ANTES — regras antigas (stop fixo 150/5 pts, 09:05, sem parar após perdas) · 4 sementes × 60 pregões

**1075 operações em 60 pregões.**

### Expectativa matemática por operação

`expectativa = %acerto × ganho médio − %erro × perda média`

= 40.7% × R$ 49,88 − 59.3% × R$ 35,99 = **R$ -1,08 por operação** (fator de lucro 0,95; margem de erro 95%: R$ -3,68 a R$ 1,52).

> ⚠️ **Expectativa NEGATIVA: o robô não tem vantagem** neste conjunto. (Com a margem de erro acima, ainda não se distingue de zero, mas também não há nenhuma evidência de lucro.)

### Custos

|  | total | por operação |
|---|---|---|
| Resultado SEM nenhum custo (preços ideais) | R$ 759 | R$ 0,71/op |
| Corretagem + emolumentos | R$ -844 | R$ -0,78/op |
| Derrapagem (slippage) medida | R$ -1.079 | R$ -1,00/op |
| Resultado LÍQUIDO | R$ -1.164 | R$ -1,08/op |

**Os custos sozinhos explicam o prejuízo**: sem custo nenhum o robô estava em R$ 759; os custos (R$ 1.922) o empurraram para R$ -1.164.

### Acerto necessário para empatar (por ativo)

| ativo | risco/op | custo/op | custo ÷ risco | acerto p/ empatar (alvo 1,5×) | acerto esperado num mercado sem vantagem | expectativa nesse mercado (R$/op) |
|---|---|---|---|---|---|---|
| WDO | R$ 50,00 | R$ 4,79 | 10% | 43.8% | 40.0% | -4,79 |
| WIN | R$ 30,00 | R$ 1,08 | 4% | 41.4% | 40.0% | -1,08 |

Num mercado em que o preço anda ao acaso, um stop com alvo 1,5× acerta ~40% das vezes. Se o acerto necessário para empatar é maior que isso, **o robô perde dinheiro só por custo, mesmo sem erro nenhum**.

### Ativo

| Ativo | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| WDO | 204 | 41% | R$ 73,00 | R$ 55,88 | R$ -2,81 | 0,91 | R$ -573 |
| WIN | 871 | 41% | R$ 44,38 | R$ 31,38 | R$ -0,68 | 0,96 | R$ -590 |

### Horário (faixas de 30 min)

| Horário | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| 09:00 | 93 | 37% | R$ 50,37 | R$ 37,55 | R$ -5,41 | 0,77 | R$ -503 |
| 09:30 | 81 | 48% | R$ 48,88 | R$ 36,96 | R$ 4,37 | 1,23 | R$ 354 |
| 10:00 | 89 | 37% | R$ 53,14 | R$ 36,89 | R$ -3,51 | 0,85 | R$ -312 |
| 10:30 | 72 | 32% | R$ 51,93 | R$ 37,16 | R$ -8,70 | 0,66 | R$ -626 |
| 11:00 | 68 | 41% | R$ 50,61 | R$ 34,61 | R$ 0,48 | 1,02 | R$ 32 |
| 11:30 | 80 | 48% | R$ 51,25 | R$ 35,75 | R$ 5,58 | 1,30 | R$ 446 |
| 12:00 | 76 | 46% | R$ 50,20 | R$ 33,71 | R$ 4,93 | 1,27 | R$ 375 |
| 12:30 | 69 | 42% | R$ 49,41 | R$ 35,33 | R$ 0,29 | 1,01 | R$ 20 |
| 13:00 | 80 | 38% | R$ 48,30 | R$ 36,77 | R$ -4,87 | 0,79 | R$ -390 |
| 13:30 | 66 | 35% | R$ 51,93 | R$ 37,43 | R$ -6,29 | 0,74 | R$ -415 |
| 14:00 | 69 | 39% | R$ 49,78 | R$ 36,14 | R$ -2,52 | 0,89 | R$ -174 |
| 14:30 | 54 | 41% | R$ 48,39 | R$ 35,48 | R$ -1,31 | 0,94 | R$ -71 |
| 15:00 | 51 | 41% | R$ 47,21 | R$ 35,12 | R$ -1,22 | 0,94 | R$ -62 |
| 15:30 | 43 | 37% | R$ 48,06 | R$ 34,33 | R$ -3,67 | 0,83 | R$ -158 |
| 16:00 | 41 | 44% | R$ 50,83 | R$ 33,72 | R$ 3,40 | 1,18 | R$ 140 |
| 16:30 | 36 | 47% | R$ 47,85 | R$ 35,53 | R$ 3,85 | 1,21 | R$ 138 |
| 17:00 | 7 | 57% | R$ 34,00 | R$ 31,17 | R$ 6,07 | 1,45 | R$ 42 |

### Dia da semana

| Dia | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| segunda | 232 | 41% | R$ 51,10 | R$ 36,88 | R$ -0,85 | 0,96 | R$ -198 |
| terça | 231 | 40% | R$ 49,46 | R$ 35,16 | R$ -1,46 | 0,93 | R$ -337 |
| quarta | 226 | 40% | R$ 48,11 | R$ 36,23 | R$ -2,27 | 0,90 | R$ -513 |
| quinta | 204 | 43% | R$ 49,68 | R$ 35,97 | R$ 0,98 | 1,05 | R$ 199 |
| sexta | 182 | 39% | R$ 51,32 | R$ 35,67 | R$ -1,73 | 0,92 | R$ -315 |

### Regime de mercado

| Regime | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| lateral | 819 | 40% | R$ 49,62 | R$ 35,68 | R$ -1,73 | 0,92 | R$ -1.414 |
| tendencia | 114 | 40% | R$ 52,55 | R$ 37,12 | R$ -0,94 | 0,96 | R$ -107 |
| volatil | 142 | 46% | R$ 49,32 | R$ 37,00 | R$ 2,51 | 1,13 | R$ 357 |

### Lado

| Lado | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| compra | 539 | 41% | R$ 49,96 | R$ 35,89 | R$ -0,53 | 0,97 | R$ -286 |
| venda | 536 | 40% | R$ 49,80 | R$ 36,09 | R$ -1,64 | 0,92 | R$ -877 |

### Estratégia

| Estratégia | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| base EMA9×EMA21, stop fixo | 1075 | 41% | R$ 49,88 | R$ 35,99 | R$ -1,08 | 0,95 | R$ -1.164 |

### Motivo de saída

| Motivo | ops | acerto | ganho médio | perda média | expectativa/op | fator de lucro | resultado |
|---|---|---|---|---|---|---|---|
| alvo | 436 | 100% | R$ 49,99 | R$ 0,00 | R$ 49,99 | ∞ | R$ 21.796 |
| limite diário | 14 | 0% | R$ 0,00 | R$ 28,57 | R$ -28,57 | 0,00 | R$ -400 |
| stop | 623 | 0% | R$ 0,00 | R$ 36,17 | R$ -36,17 | 0,00 | R$ -22.532 |
| zeragem de fim de dia | 2 | 50% | R$ 2,50 | R$ 30,50 | R$ -14,00 | 0,08 | R$ -28 |

> 🔴 = prejuízo estatisticamente provado (≥30 ops e margem de erro toda abaixo de zero). Recortes com poucas operações (<30) são ruído: **não bloqueie nada com base neles**.

### Cortes justificados pelos dados

Nenhum recorte tem prejuízo PROVADO (≥30 operações e margem de erro abaixo de zero). Por isso **nenhum horário/ativo/regime/lado foi cortado por palpite**.

### As 20 piores operações

| # | quando | o quê | resultado | saída | regime | o que o robô viu / por que entrou | o que deveria ter feito |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-09 10:35 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 2 | 2026-11-11 09:30 | WDOZ26 venda 1× | R$ -57,00 | stop | volatil | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava muito agitado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); mercado muito agitado: stop e preço de entrada ficam instáveis |
| 3 | 2026-11-11 10:30 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 4 | 2026-11-11 13:45 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 5 | 2026-11-11 14:00 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 6 | 2026-11-11 14:45 | WDOZ26 venda 1× | R$ -57,00 | stop | volatil | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava muito agitado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); mercado muito agitado: stop e preço de entrada ficam instáveis |
| 7 | 2026-11-11 15:20 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta); já vinha de 2 perdas seguidas no dia: deveria ter parado |
| 8 | 2026-11-11 15:45 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta); já vinha de 3 perdas seguidas no dia: deveria ter parado |
| 9 | 2026-11-12 09:05 | WDOZ26 venda 1× | R$ -57,00 | stop | volatil | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava muito agitado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); mercado muito agitado: stop e preço de entrada ficam instáveis; entrou nos primeiros 15 min (leilão/gap/spread largo) |
| 10 | 2026-11-12 10:15 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 11 | 2026-11-13 09:15 | WDOZ26 venda 1× | R$ -57,00 | stop | volatil | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava muito agitado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); mercado muito agitado: stop e preço de entrada ficam instáveis |
| 12 | 2026-11-13 10:30 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 13 | 2026-11-13 10:35 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 14 | 2026-11-13 10:50 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 15 | 2026-11-16 09:25 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 16 | 2026-11-16 11:15 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 17 | 2026-11-18 12:45 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 18 | 2026-11-19 12:00 | WDOZ26 venda 1× | R$ -57,00 | stop | lateral | Vendi porque a média rápida cruzou para baixo da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 19 | 2026-11-19 12:20 | WDOZ26 compra 1× | R$ -57,00 | stop | lateral | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava andando de lado. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); cruzamento de médias em mercado lateral costuma falhar (vai e volta) |
| 20 | 2026-11-23 09:05 | WDOZ26 compra 1× | R$ -57,00 | stop | tendencia | Comprei porque a média rápida cruzou para cima da lenta e o mercado estava em tendência. Stop fixo de 5 pontos. | stop FIXO de 5 pts (não olha a volatilidade do momento); entrou nos primeiros 15 min (leilão/gap/spread largo) |

### Integridade da execução (procura de bugs)

- ✅ nenhum ticket duplicado
- ✅ toda operação tem stop gravado
- ✅ nenhuma posição esquecida
- ✅ toda saída tem preço e resultado
- 🚨 46 entrada(s) nos primeiros 15 min do pregão
- ✅ limite de operações por dia respeitado
- ✅ limite de perda diário nunca estourou em mais de 50%
- ✅ nenhuma ordem duplicada em <5 s
- ✅ nunca duas posições ao mesmo tempo no mesmo ativo

### Veredito

**SEM VANTAGEM** — a expectativa fora da amostra é zero ou negativa: **a estratégia não tem vantagem**.

|  | ops | expectativa/op | fator de lucro |
|---|---|---|---|
| dentro da amostra (primeiros 70%) | 752 | R$ -0,36 | 0,98 |
| FORA da amostra (últimos 30%) | 323 | R$ -2,76 | 0,87 |
## Simulador — DEPOIS — regras v2 (stop técnico ATR, 09:15, para após 2 perdas, notícias), perfil Conservador R$ 50/op · 4 sementes × 60 pregões

**19 operações em 16 pregões.**

### Expectativa matemática por operação

`expectativa = %acerto × ganho médio − %erro × perda média`

= 26.3% × R$ 71,10 − 73.7% × R$ 45,29 = **R$ -14,66 por operação** (fator de lucro 0,56; margem de erro 95%: R$ -38,39 a R$ 9,07).

> ⚠️ **Expectativa NEGATIVA: o robô não tem vantagem** neste conjunto. (Com a margem de erro acima, ainda não se distingue de zero, mas também não há nenhuma evidência de lucro.)

### Custos

|  | total | por operação |
|---|---|---|
| Resultado SEM nenhum custo (preços ideais) | R$ -255 | R$ -13,42/op |
| Corretagem + emolumentos | R$ -10 | R$ -0,50/op |
| Derrapagem (slippage) medida | R$ -14 | R$ -0,74/op |
| Resultado LÍQUIDO | R$ -278 | R$ -14,66/op |

Os custos (R$ 24) agravam, mas **não explicam sozinhos**: sem custo nenhum o resultado já era R$ -255 (as perdas vêm das próprias operações).

### Acerto necessário para empatar (por ativo)

| ativo | risco/op | custo/op | custo ÷ risco | acerto p/ empatar (alvo 1,5×) | acerto esperado num mercado sem vantagem | expectativa nesse mercado (R$/op) |
|---|---|---|---|---|---|---|
| WIN | R$ 44,79 | R$ 1,24 | 3% | 41.1% | 40.0% | -1,24 |

Num mercado em que o preço anda ao acaso, um stop com alvo 1,5× acerta ~40% das vezes. Se o acerto necessário para empatar é maior que isso, **o robô perde dinheiro só por custo, mesmo sem erro nenhum**.

### Integridade da execução (procura de bugs)

- ✅ nenhum ticket duplicado
- ✅ toda operação tem stop gravado
- ✅ nenhuma posição esquecida
- ✅ toda saída tem preço e resultado
- ✅ nenhuma entrada nos primeiros 15 min
- ✅ limite de operações por dia respeitado
- ✅ limite de perda diário nunca estourou em mais de 50%
- ✅ nenhuma ordem duplicada em <5 s
- ✅ nunca duas posições ao mesmo tempo no mesmo ativo

### Veredito

**SEM PROVA** — só 6 operações fora da amostra (precisa de ≥100). Não dá para afirmar vantagem.

|  | ops | expectativa/op | fator de lucro |
|---|---|---|---|
| dentro da amostra (primeiros 70%) | 13 | R$ -9,58 | 0,69 |
| FORA da amostra (últimos 30%) | 6 | R$ -25,67 | 0,33 |
## Simulador — DEPOIS — regras v2 com orçamento de risco maior (R$ 100/op, só para medir quantas operações surgem) · 4 sementes × 60 pregões

**308 operações em 60 pregões.**

### Expectativa matemática por operação

`expectativa = %acerto × ganho médio − %erro × perda média`

= 42.2% × R$ 106,92 − 57.8% × R$ 78,57 = **R$ -0,28 por operação** (fator de lucro 0,99; margem de erro 95%: R$ -11,06 a R$ 10,50).

> ⚠️ **Expectativa NEGATIVA: o robô não tem vantagem** neste conjunto. (Com a margem de erro acima, ainda não se distingue de zero, mas também não há nenhuma evidência de lucro.)

### Custos

|  | total | por operação |
|---|---|---|
| Resultado SEM nenhum custo (preços ideais) | R$ 358 | R$ 1,16/op |
| Corretagem + emolumentos | R$ -204 | R$ -0,66/op |
| Derrapagem (slippage) medida | R$ -240 | R$ -0,78/op |
| Resultado LÍQUIDO | R$ -86 | R$ -0,28/op |

**Os custos sozinhos explicam o prejuízo**: sem custo nenhum o robô estava em R$ 358; os custos (R$ 444) o empurraram para R$ -86.

### Acerto necessário para empatar (por ativo)

| ativo | risco/op | custo/op | custo ÷ risco | acerto p/ empatar (alvo 1,5×) | acerto esperado num mercado sem vantagem | expectativa nesse mercado (R$/op) |
|---|---|---|---|---|---|---|
| WDO | R$ 89,69 | R$ 5,12 | 6% | 42.3% | 40.0% | -5,12 |
| WIN | R$ 82,53 | R$ 1,01 | 1% | 40.5% | 40.0% | -1,01 |

Num mercado em que o preço anda ao acaso, um stop com alvo 1,5× acerta ~40% das vezes. Se o acerto necessário para empatar é maior que isso, **o robô perde dinheiro só por custo, mesmo sem erro nenhum**.

### Integridade da execução (procura de bugs)

- ✅ nenhum ticket duplicado
- ✅ toda operação tem stop gravado
- ✅ nenhuma posição esquecida
- ✅ toda saída tem preço e resultado
- ✅ nenhuma entrada nos primeiros 15 min
- ✅ limite de operações por dia respeitado
- ✅ limite de perda diário nunca estourou em mais de 50%
- ✅ nenhuma ordem duplicada em <5 s
- ✅ nunca duas posições ao mesmo tempo no mesmo ativo

### Veredito

**SEM PROVA** — só 93 operações fora da amostra (precisa de ≥100). Não dá para afirmar vantagem.

|  | ops | expectativa/op | fator de lucro |
|---|---|---|---|
| dentro da amostra (primeiros 70%) | 215 | R$ 5,07 | 1,12 |
| FORA da amostra (últimos 30%) | 93 | R$ -12,65 | 0,75 |
