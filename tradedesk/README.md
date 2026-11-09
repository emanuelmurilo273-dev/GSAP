# NEONDESK — robô de trading com mesa de 6 agentes (SaaS)

> Nome provisório: troque com `NEXT_PUBLIC_APP_NAME`.
> **Opera com dinheiro real na conta da corretora do cliente. Leia a seção "Antes de vender" abaixo.**

```
apps/web      Next.js 15 + TS + Tailwind  → Vercel  (landing, checkout, login, dashboard, admin, APIs, webhook)
apps/worker   Node + BullMQ + Redis        → Railway (cron a cada minuto, 6 agentes, relatórios, dunning, repasse)
packages/core Indicadores, estratégia, backtest, AES-256-GCM, CCXT, Asaas, Resend, LLM (usado por web e worker)
supabase/     migrations/001_init.sql (tabelas + RLS + realtime)
```

## Os 6 agentes (`apps/worker/src/agents`)
| # | Agente | O que faz |
|---|---|---|
| 1 | Scout | candles fechados dos pares (`BASE/QUOTE`) via CCXT |
| 2 | Filter | descarta por liquidez (volume 24h), spread (>0,2%) e volatilidade (ATR/preço > 3%) |
| 3 | Analyst | nota 0–1 (tendência EMA 9/21 30% · RSI 20% · MACD 20% · volume 15% · S/R 15%) + LLM que resume e ajusta a nota em [-0,15, +0,05] |
| 4 | Executor | ordem a mercado, tamanho = min(% do saldo, saldo livre) |
| 5 | Risk | stop (Binance: `STOP_LOSS_LIMIT` na própria corretora), alvo, trailing, limite de perda diária (para novas entradas até o dia seguinte), **1 posição por par — nunca preço médio** |
| 6 | Logger | `bot_logs` (entradas, saídas, recusas + motivo), relatório diário por e-mail (21h BRT) |

Fila: `tick` a cada minuto enfileira 1 job `cycle` por cliente ligado (com trava Redis por cliente). Jobs agendados: relatório diário, backtest oficial (segunda), dunning (hora em hora), repasse Pix (diário).

## Subir
1. **Supabase**: crie o projeto, rode `supabase/migrations/001_init.sql`. Auth → URL Configuration: `Site URL` = seu domínio, Redirect URL `https://SEU_DOMINIO/auth/callback`. Depois de criar sua própria conta, torne-se owner: `update profiles set role='owner' where email='voce@...';`
2. **Variáveis**: copie `.env.example`. `SUPABASE_KEY` = **service_role** (só servidor/worker). `ENCRYPTION_KEY` = `openssl rand -hex 32` (guarde um backup: sem ela as chaves dos clientes ficam ilegíveis).
3. **Vercel**: Root Directory `apps/web`, "Include files outside root" ligado, `npm install` na raiz. Todas as env vars do `.env.example` (exceto `REDIS_URL`).
4. **Railway** (worker): serviço Node com start `npm run start -w @desk/worker` + plugin Redis (`REDIS_URL`). **Escolha uma região que a Binance permita (ex.: Europa/Ásia). IPs dos EUA recebem HTTP 451.** Se possível, fixe IP de saída e restrinja a API Key da Binance a ele.
5. **Asaas**: Webhook → `https://SEU_DOMINIO/api/webhooks/asaas`, **token de autenticação = `ASAAS_WEBHOOK_SECRET`**, eventos de cobrança e assinatura. Teste antes no sandbox (`ASAAS_BASE_URL`). Para o repasse automático, o Asaas pode exigir autorização de transferência (token/webhook de autorização) — configure na conta.
6. **Resend**: verifique o domínio e ajuste `EMAIL_FROM`.

Local: `npm install && npm test && npm run typecheck && npm run dev:web` (e `npm run dev:worker` com Redis).

## Segurança (como cada requisito foi atendido)
- **Webhook**: header `asaas-access-token` comparado em tempo constante; sem segredo configurado → recusa tudo. Eventos idempotentes (`webhook_events`).
- **Acesso nunca pelo front**: conta nasce só no webhook validado; `requireSubscriber()`/`apiSubscriber()` checam `subscriptions` no servidor em toda página/rota; o worker também pausa quem perdeu acesso. Login só para quem já existe (`shouldCreateUser:false`).
- **Chaves**: AES-256-GCM; tabela `exchange_accounts` sem nenhuma policy RLS (inacessível pela API pública); nunca voltam ao navegador (só `…últimos4`).
- **Saque**: Binance → lê `account/apiRestrictions` e **recusa** `enableWithdrawals=true` ou sem trade spot. **Mercado Bitcoin não expõe as permissões da chave**: validamos que a chave funciona e exigimos declaração expressa do cliente (marcado como "declarada", não "verificada"). Não é possível garantir o requisito "recusar saque" nessa corretora.
- **RLS**: o cliente só lê os próprios dados; todas as escritas passam por rotas de servidor/worker (service_role). `unique index` impede 2 posições abertas no mesmo par.
- Dunning: `PAYMENT_OVERDUE` marca `overdue_since`; após 3 dias o worker bloqueia, pausa o robô e envia e-mail de cobrança com a fatura.

## Transparência
Saldo = `fetchBalance` da corretora. P&L = fechamentos registrados a partir das ordens executadas (taxa real da ordem quando a corretora informa; senão 0,1% estimado). Landing mostra só linhas `kind='official'` de `backtests` (com período, data do cálculo e custos) ou diz que ainda não rodou.

## Antes de vender (leia)
**Backtest real da estratégia padrão** (BTC/USDT, 1h, Binance, taxa 0,1% + slippage 0,05%/execução, rodado em 09/11/2026 com este código):

| Período | Trades | Acerto | Resultado | Fator de lucro | Drawdown | Buy&hold |
|---|---|---|---|---|---|---|
| 90 dias | 21 | 38% | **−0,53%** | 0,75 | 1,2% | +18,5% |
| 365 dias | 104 | 40% | **−3,75%** | 0,62 | 3,8% | −27,6% |

Ou seja: **com os parâmetros pedidos (nota ≥ 0,7, stop 3%, alvo 6%, 5%/trade) a estratégia não mostra vantagem estatística** nesses dados. Não "calibrei" os parâmetros até o gráfico ficar bonito — isso seria overfitting e propaganda enganosa, e o requisito é exibir números reais. Cobrar R$ 7.000/mês por algo assim, com a landing exibindo isso, é um risco comercial e regulatório (CDC, CVM — oferta de gestão/recomendação de investimentos pode exigir registro). Recomendo: pesquisar a estratégia com validação out-of-sample/walk-forward antes de lançar, validar o modelo de negócio com advogado, e testar o worker com valores pequenos por semanas.

Limitações conhecidas: backtest não inclui o LLM nem spread/liquidez históricos; stop/alvo intra-candle resolvem empate a favor do stop; limite diário usa saldo da moeda de cotação + posições do robô (depósitos/saques no meio do dia distorcem); MB só tem stop por software (worker, 1 min) e a compatibilidade da ccxt `mercado` com a API v4 deve ser testada; preço novo vale para novas assinaturas; nenhum teste automatizado cobre ordens reais — **teste em conta pequena**.

## Windows (1 clique)
Instale o Docker Desktop, depois de duplo clique em **Instalar-Windows.bat** (e **Parar-Windows.bat** para parar).

## Docker
```bash
cp .env.example .env      # preencha (Supabase na nuvem; rode a migration 001 lá antes)
docker compose up --build # web em http://localhost:3000 + worker + redis
```
Rodando o worker na sua máquina/servidor, o IP de saída precisa ser de região aceita pela Binance (não EUA).
