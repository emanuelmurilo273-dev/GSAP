# HEXADESK — robô de day trade na B3 (WIN/WDO) via MetaTrader 5

> **Foco atual: day trade de mini índice (WIN) e mini dólar (WDO) na B3, pela Clear, com o MetaTrader 5.**
> O código de cripto (Binance/Bybit, pasta `apps/web/app/app`, worker BullMQ) continua no repositório como **legado**, sem uso.
> **Comece por [`docs/B3-GUIA.md`](docs/B3-GUIA.md)**: conta Clear, MT5, conta DEMO, conector no seu PC e VPS.


# 🚀 Produto final: o que é, o que está pronto e o que NÃO está

**HEXADESK** é um robô de trading automático com app web: **cripto 24h na Foxbit** (BTC/BRL, ETH/BRL, SOL/BRL; Mercado Bitcoin como alternativa) e **B3 (WIN/WDO) pelo MT5 da Clear**, durante o pregão. O dinheiro fica na conta do cliente; o app nunca recebe depósitos.

> ## ⛔ Estado honesto: ainda NÃO tem vantagem comprovada
> - **Cripto na Foxbit** (2 anos de dados e taxas reais, 0,5% por lado): fator de lucro **0,37 a 0,63**, média de **−0,7% a −1,45% por operação** → [`research/RESEARCH_CRIPTO_FOXBIT.md`](research/RESEARCH_CRIPTO_FOXBIT.md).
> - **B3**: nenhuma das 5 famílias de estratégia passou na seleção → [`research/RESEARCH_B3.md`](research/RESEARCH_B3.md) e [`DIAGNOSTICO.md`](DIAGNOSTICO.md).
> - Por isso `STRATEGY_APPROVED=false` e `SALES_OPEN=false`: **a venda não abre, a landing mostra lista de espera e clientes não ligam o robô**. A venda só abre quando uma estratégia passar no teste fora da amostra (PF ≥ 1,3 · perda máx. ≤ 15% · ≥ 300 operações) **e** você mudar as duas variáveis.

## O que está implementado
| Área | Estado |
|---|---|
| Foxbit: ordens, **stop STOP_MARKET na corretora**, taxas reais, chave sem saque (por declaração: a Foxbit não expõe permissões), WebSocket oficial no gráfico | ✅ código + testes com corretora simulada; ⚠️ **nunca rodou com chave real** (use `scripts/ordem-minima.ts --confirmo`) |
| Proteções de cripto: risco ≤ 1% por operação, sem alavancagem, limite diário, **para após 2 perdas**, máx. operações/dia, **pausa se a conta cair 10% do pico** (e avisa) | ✅ testadas |
| Proteções da B3: stop no servidor, limite em R$, 2 perdas, zeragem 17:30, 1 contrato até provar, volta ao simulador se cair 10% | ✅ testadas (simulador); ⚠️ nunca no MT5 real |
| Estatísticas **só reais** (com ID da ordem): hoje/semana/mês/ano/total, acerto, expectativa em R$, fator de lucro, sequências, drawdown, custos separados, calendário, por mercado/ativo/horário, **extrato CSV e PDF** | ✅ |
| Página pública `/resultados` com o histórico completo (dias negativos incluídos) | ✅ |
| Landing, FAQ, termos, privacidade (LGPD), aviso de risco, lista de espera, checkout Asaas (Pix/cartão) **atrás da aprovação** | ✅ (textos jurídicos são modelo: **precisam de advogado**) |
| App: Início, Ao vivo, Estatísticas, Histórico, Configurações, onboarding de 3 passos, glossário "?" | ✅ |
| Dono: login com senha + 2FA, entra no `/admin` (clientes, receita, **saúde do robô de cada cliente**, erros, versões), auditoria | ✅ |
| Laboratório (dono): simulador/demo da B3 em `/b3`, campeão × desafiante | ✅ (invisível ao público; nada dele entra nas estatísticas) |
| Alertas: e-mail por operação, limite, queda de conexão, volta ao simulador e **resumo às 18:00**; push opcional via ntfy | ✅ código; exige Resend e um monitor chamando `/api/cron/watchdog` a cada 5 min |
| Infra: worker com `restart` + healthcheck + alerta se parar, conector com reinício automático, `/api/health` para uptime, `scripts/backup.sh` | ✅ |

## O que NÃO está pronto (limitações reais)
1. **B3 para clientes**: o conector e as tabelas da B3 são de **uma conta só (a do dono)**. Cada cliente ter o próprio conector MT5 exige multiusuário nas tabelas `b3_*` e um token por conector: **não foi feito**. Hoje a B3 aparece só para o dono; clientes têm cripto.
2. **Laboratório de cripto (paper trading)** não existe: a Foxbit não tem testnet e não foi construído um simulador de ordens de cripto. O Laboratório cobre só a B3.
3. **Push** nativo no celular: só via ntfy (opcional). **PDF**: extrato imprimível ("Salvar como PDF" do navegador), não um gerador de PDF.
4. **Prints do tutorial do MT5/Foxbit**: são esquemas desenhados, não capturas reais.
5. **Modelo LightGBM e fluxo de ordens** seguem desligados: nenhum passou no protocolo.
6. Nada foi testado com dinheiro real, chaves reais da Foxbit/Asaas/Resend ou MT5 real.

## Passo a passo para publicar (quando houver estratégia aprovada)
1. **Contas**: Supabase (banco), Asaas (cobrança), Resend (e-mail), Foxbit (a sua, para o robô do dono), hospedagem do site (Vercel ou o Docker deste repositório) e do worker (Fly.io região `gru` — ver `fly.toml`), VPS Windows em São Paulo para o conector da B3 (guia: `docs/B3-GUIA.md`, seção 5).
2. **Banco**: rode as migrations `supabase/migrations/001` a `009` em ordem.
3. **Variáveis** (`.env.example`): chaves do Supabase/Asaas/Resend, `ENCRYPTION_KEY`, `OWNER_EMAIL`, `OWNER_PIX_KEY`, `EXCHANGES_ENABLED=foxbit`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
4. **Conta de dono**: entre com `OWNER_EMAIL`, ative o 2FA (você cai direto em `/admin`).
5. **Teste com ordem mínima na SUA conta**: `FOXBIT_KEY=... FOXBIT_SECRET=... npx tsx scripts/ordem-minima.ts --confirmo`. Rode o conector B3 na conta demo da Clear por semanas.
6. **Monitoramento**: um serviço de uptime em `/api/health` e outro chamando `/api/cron/watchdog` (com `CRON_SECRET`) a cada 5 min; agende `scripts/backup.sh` por dia.
7. **Aprovação**: só com estratégia aprovada (veja acima), ponha `STRATEGY_APPROVED=true` e `SALES_OPEN=true`. Antes disso a landing mantém a lista de espera.
8. **Jurídico**: peça a um advogado para revisar termos e privacidade e dizer se o serviço exige autorização da CVM.


## ⚠️ Diagnóstico de perdas e proteções v2 (leia primeiro)

O robô estava perdendo dinheiro. Foi feita uma autópsia completa: **[`DIAGNOSTICO.md`](DIAGNOSTICO.md)**.

- **Proteção imediata** (migration `007_b3_protecao_diagnostico.sql`, aplicada pelo instalador): volta ao **SIMULADOR**, **trava o modo real** (`real_locked`), limite de perda do perfil Conservador (R$ 100/dia, R$ 50/operação, 1 contrato, 3 operações/dia). A trava só abre na aba **Saúde do robô**, digitando `LIBERAR APÓS DIAGNÓSTICO`; mesmo aberta, o modo real ainda exige as demais liberações. O conector também respeita a trava.
- **Regras v2** (sempre ligadas, `connector/hexadesk_connector/safety.py`): nada nos primeiros 15 min; nada 15 min antes/depois de notícia forte; para o dia após 2 perdas seguidas; stop **técnico** (≥1×ATR e além da última região de preço) com alvo ≥1,5× o stop; a operação só entra se o risco dela **cabe no que resta do limite de perda do dia**; nunca aumenta a mão depois de perda (sem martingale, sem preço médio, sem tirar stop).
- **Correções de execução**: desvio máximo de preço das ordens agora é de 2–3 ticks (era 20/30 fixos: no mini dólar isso era mais de 4× o stop), e o robô só enxerga/zera as **suas** posições (magic number), nunca as manuais.
- **Autópsia dos SEUS trades**: `connector\Autopsia.bat` (gera `DIAGNOSTICO-SEUS-DADOS.md`). Ela lê o banco e **não altera nada**. Cortes (horário/ativo/regime/lado) só são sugeridos com prova estatística.
- **Saúde do robô** (`/b3/saude`): semáforo + expectativa por operação em R$. **Verde só com ≥100 operações e margem de erro acima de zero.**
- **Novo visual**: tela inicial com saldo, resultado do dia, botão LIGAR/DESLIGAR, uma frase do robô e cartões de operações com "por quê?". O painel técnico antigo está em `/b3/detalhes`. Capturas em `docs/screenshots/v2-*.png`.

## Começar em 6 passos (para quem nunca fez isso)

1. **Abra conta na Clear** (clear.com.br) e peça acesso ao **MetaTrader 5**. *(Detalhes: `docs/B3-GUIA.md`, seção 1–2.)*
2. **No MT5, crie a conta DEMO** (servidor `ClearInvestimentos-DEMO`): dinheiro de mentira, preços reais.
3. **Instale o app no seu Windows**: dê dois cliques em `Instalar-Windows.bat`. Ele pede o seu e-mail e senha de dono, liga tudo e abre o site.
4. **Instale o conector** (o programa que fala com o MT5): `connector\Instalar-Conector-Windows.bat`. Ele pede o login/senha da conta **demo**.
5. **Abra o site → Começar**: o app guia 3 passos (conectar o MT5 → escolher o perfil, mostrando o pior dia em R$ → ligar).
6. **Deixe rodar na demo por semanas** e acompanhe a aba **Saúde do robô**. Só pense em dinheiro real quando ela estiver verde *e* o app liberar (seção 6b do guia).

Para o robô rodar o dia todo sem o seu PC, use uma **VPS Windows em São Paulo** (guia, seção 5: preços vistos em sites de terceiros — a partir de ~R$ 100/mês, e planos feitos para MT5/B3 por volta de R$ 200/mês; confirme no site do provedor antes de pagar). **Publicar o app na internet** (opcional): seção "Publicar na internet" abaixo.

## Duas melhorias novas (ao vivo + inteligência)

- **Ao vivo** (`/b3/live`): candles M1/M5/M15 em tempo real, VWAP, médias, volume, marcadores de compra/venda do robô, linhas de stop e alvo, livro de ofertas e *times & trades*. O conector envia só as diferenças (Supabase Realtime) e, se o canal cair, o painel volta sozinho para sondagem de 1 s. **Passou de 5 s sem tick → alerta vermelho "DADOS ATRASADOS".**
- **Histórico próprio**: todo tick e todo livro são gravados em `%LOCALAPPDATA%\HexadeskConnector\data\ticks\AAAA-MM-DD\` (CSV compactado, só acrescenta). Escolhi CSV gzip em vez de TimescaleDB/Parquet por não exigir nada a instalar; a leitura está em `live.read_ticks` e `connector/tools/exportar_historico.py`.
- **Inteligência** (`/b3/inteligencia`): regime de mercado, confirmação por fluxo, filtro de notícias (calendário editável por você), modelo LightGBM de probabilidade, risco adaptativo (sem martingale) e Analyst (IA que só explica). **Todas as camadas vêm DESLIGADAS** — ver o motivo em [`research/RESEARCH_B3.md`](research/RESEARCH_B3.md).
- **Campeão × desafiante**: toda versão nova roda em paralelo no simulador (sem dinheiro). Só vira campeã com ≥10 pregões, ≥30 operações e melhor fator de lucro, perda máxima e Sharpe com **preços reais do MT5** — e só com o seu clique (o servidor recusa se não passar).
- **Reaprendizado semanal**: `python -m hexadesk_connector retreinar` (agendado por `connector/Retreinar-Semanal.bat`; precisa de `pip install -r connector/requirements-ml.txt`). Só cria um *desafiante*, nunca troca o campeão.
- **Custos** usados nos testes: 1 tick de derrapagem + emolumentos de **placeholder** (WIN R$0,50 / WDO R$2,00 ida e volta). **Confirme as taxas reais na Clear** antes de confiar em qualquer número.
- Migração `supabase/migrations/006_b3_live_intel.sql` (o instalador aplica). Para o Analyst: `LLM_API_KEY` (Anthropic) no `.env`.

## Como funciona (B3)
```
 MT5 da Clear (Windows)  ⇄  Conector Python (connector/)  ⇄  Supabase  ⇄  Painel web (/b3)
 login/senha só aqui, criptografados         ordens, stops, risco          celular/PC
```
- **Conector** (`connector/`): lê preços, calcula, envia ordens **com stop gravado no servidor da corretora**, zera às 17:30, respeita limite de perda diário em R$, 1 posição por ativo, rolagem automática de WINxxx/WDOxxx. Roda no Windows ao lado do MT5 (seu PC ou VPS).
- **Painel** (`/b3`): faixa fixa **azul SIMULADOR** / **vermelha DINHEIRO REAL**, saldo, resultado do dia, posições, log ao vivo, **PARAR TUDO**, configurações, liberação do modo real.
- **Simulador é o padrão** (conta DEMO). **REAL só libera com TODAS as condições**: (1) estratégia **aprovada no teste fora da amostra** (PF ≥ 1,3, drawdown ≤ 15%, ≥ 300 trades, positiva nos dois ativos); (2) expectativa por operação **positiva em R$** na conta demo do MT5; (3) **≥ 20 pregões** na demo com resultado positivo; (4) resultado da demo **próximo do esperado no teste**; (5) as duas confirmações + `OPERAR REAL`; (6) a trava do diagnóstico aberta; (7) trava local no conector. No real: **1 contrato** até 30 pregões reais positivos (depois +1 a cada 15), e se o saldo cair **10% abaixo do pico** o robô volta sozinho ao simulador e avisa. Hoje **nenhuma estratégia foi aprovada**, então o real está bloqueado. O conector **recusa** operar se o tipo da conta (demo/real) não bater com o modo.

### Estado desta versão (honesto)
| Item | Situação |
|---|---|
| Regras do motor (horário, feriados, rolagem, risco, stop, zeragem, PARAR TUDO, travas demo/real) | ✅ 34 testes com **MT5 simulado** (`npm run test:connector`) |
| Segurança do banco (só o dono com 2FA lê dados B3) | ✅ 16 testes de RLS em Postgres real (PGlite) |
| **Conector falando com um MT5 de verdade** | ⚠️ **NUNCA executado**: precisa de Windows + MT5 + conta demo (só você tem). Pode haver ajustes (modo de preenchimento da ordem, símbolos, stops na B3) |
| Nome do servidor `ClearInvestimentos-DEMO`, política de robôs e horário de zeragem da Clear | ⚠️ **não confirmados** (ver o guia) |
| **Estratégia** | ⚠️ só uma estratégia de teste (cruzamento de EMAs), **NÃO validada**. A pesquisa para WIN/WDO ainda não foi feita (aguardando o restante do pedido) |
| Regras do modo REAL (todas as condições, 1 contrato, trava de 10% do pico, posições órfãs após reiniciar) | ✅ testes de regras (core) + do motor (conector); ⚠️ **nunca usado com dinheiro/MT5 real** |
| **Simulador interno** (mercado ARTIFICIAL, dinheiro fictício, sem MT5; sobe sozinho no Docker) | ✅ 7 testes (contabilidade, zeragem, horários, origem separada, PARAR TUDO, liga sozinho 1×); ⚠️ preços **inventados** — não provam nada |
| Painel B3 no navegador (telas com dados de exemplo em `docs/screenshots/b3-*.jpg`) | ✅ build e telas; ❌ não testado com o conector real |
| Alertas ao dono: e-mail (cada operação, limites, volta ao simulador, conector caiu) e resumo às 18:00; push no celular opcional via ntfy (`NTFY_TOPIC`) | ✅ código e testes do resumo; exige Resend + agendador (monitor chamando `/api/cron/watchdog` a cada 5 min); ⚠️ nunca enviado com chaves reais |

> ## ⚠️ (cripto, legado) Leia antes de vender
> 1. **Nenhuma estratégia passou na pesquisa de validação** (`research/RESEARCH.md`: 5 famílias × 3 pares × 3 timeframes, 3 anos, walk-forward, teste final uma única vez). Por isso, `STRATEGY_APPROVED=false` e **clientes não conseguem ligar o robô em conta real**. Só funciona em *testnet* (dinheiro de mentira) e na **conta do dono**.
> 2. A estratégia padrão do app tem backtest real **negativo** (BTC/USDT 1h: −0,53% em 90 dias; −3,75% em 365 dias).
> 3. Vender uma "gestão automática de investimento" pode exigir registro/autorização (CVM) e tem regras do Código de Defesa do Consumidor. **Fale com um advogado antes de cobrar.**
> 4. Nada aqui foi testado com dinheiro real nem com as contas reais de Asaas/Resend/Supabase (ver "O que foi testado").

---

## Como usar no Mac (1 duplo clique)

1. Instale o **Docker Desktop** (docker.com; escolha Apple Silicon ou Intel) e o **Node.js LTS** (nodejs.org).
2. Na pasta do projeto, dê duplo clique em **`Instalar-Mac.command`** (se o macOS bloquear: botão direito → Abrir → Abrir; ou no Terminal: `bash Instalar-Mac.command`).
3. Ele cria o banco e o login locais, pede seu e-mail e senha de dono e abre o site já logado. Para parar: `Parar-Mac.command`.
4. **Limite do Mac:** o conector do MetaTrader 5 (B3) **só roda no Windows**. No Mac sobem o site, o robô de cripto (Foxbit) e o Laboratório; para a B3 use um PC ou uma VPS Windows (`docs/B3-GUIA.md`).

## Como usar no Windows (1 clique, sem criar conta em site nenhum)
1. Instale o **Docker Desktop** e o **Node.js (versão LTS)**. Abra o Docker Desktop (espere ficar verde).
2. Extraia a pasta e dê duplo clique em **`Instalar-Windows.bat`**.
3. Quando perguntar *"Instalar o banco e o login automaticamente neste PC?"*, responda **S**. Ele pede **seu e-mail e uma senha**, baixa e inicia um Supabase **local** (na primeira vez leva 5–15 min), cria sua conta de **dono** e **abre o site já logado**.
4. Nas próximas vezes, rode o instalador de novo: ele sobe tudo e abre já logado. (Ou entre em `/owner/login` com e-mail e senha.) Para parar: `Parar-Windows.bat` — seus dados ficam guardados.

**Instalação local = sem 2FA** (só vale com o site em `localhost`; em qualquer endereço de internet o 2FA volta a ser obrigatório, mesmo que `OWNER_REQUIRE_2FA=false`). Dados e login ficam só no seu PC.
Se não tiver o Node.js, o instalador abre a página de download; sem ele, o site sobe em *modo prévia* (sem login).
Para um site na internet com clientes, use o Supabase na nuvem (próxima seção).

## Passo a passo das contas (faça nesta ordem)

### 1. Supabase (banco + login) — grátis
1. Crie um projeto em supabase.com.
2. **SQL Editor** → cole e rode `supabase/migrations/001_init.sql` e depois `002_owner_audit_health.sql`.
3. **Project Settings → API**: copie *Project URL* → `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`; *anon public* → `NEXT_PUBLIC_SUPABASE_ANON_KEY`; *service_role* → `SUPABASE_KEY` (secreta).
4. **Authentication → URL Configuration**: *Site URL* = endereço do seu site; em *Redirect URLs* adicione `SEU_SITE/auth/callback`.
5. **Authentication → Multi-Factor**: confirme que **TOTP** está habilitado (necessário para o 2FA do dono).

### 2. Chave de criptografia
`ENCRYPTION_KEY` — o instalador do Windows gera sozinho. À mão: `openssl rand -hex 32`. **Guarde um backup**: sem ela, as chaves de corretora salvas ficam ilegíveis.

### 3. Conta do dono (você) — sem pagar
1. Coloque seu e-mail em `OWNER_EMAIL` (recebe também os alertas).
2. **Crie a conta:** no Windows, duplo clique em **`Criar-Dono-Windows.bat`** (ou `npx tsx --env-file=.env scripts/criar-dono.ts`). Ele cria o usuário, marca como dono e mostra/envia o link de acesso. (Alternativa: `SEU_SITE/owner/login` → "Primeiro acesso: enviar link mágico".)
3. Defina uma senha (12+ caracteres) e escaneie o QR no Google Authenticator/Authy.
4. Pronto: você cai direto no **painel de operações** (o Admin fica no menu; `OWNER_HOME=/admin` inverte). Próximos logins: e-mail + senha + código de 6 dígitos. (O link mágico sozinho **não** abre o Admin: sempre exige o 2FA.)
- Você não precisa de assinatura, nunca é bloqueado e não aparece na lista de assinantes. Todo login seu e toda ação no Admin ficam no **log de auditoria**.

### 4. Binance **TESTNET** (dinheiro de mentira) — comece por aqui
1. Entre em testnet.binance.vision (login com GitHub) → *Generate HMAC-SHA-256 Key*.
2. No `.env`: `BINANCE_TESTNET=true`. No app, conecte essa chave em *Config*.
3. Rode backtest → aceite o termo → ligue o robô e acompanhe as ordens no testnet.

### 4b. Bybit (alternativa à Binance)
1. Na Bybit: **Perfil → API → Criar nova chave → "Chaves geradas pelo sistema"**. Permissões: **Leitura e Escrita**; em **Spot** marque **Trade**; em **Carteira NÃO marque Saque**. Se puder, restrinja ao seu IP.
2. No `.env`: `EXCHANGES_ENABLED=bybit` (o instalador pergunta). Cole a chave em *Config → Corretora*.
3. O app consulta as permissões reais da chave (`/v5/user/query-api`) e **recusa** se tiver saque, se for só leitura ou se não conseguir ler as permissões (falha para o lado seguro).
4. Testnet: crie conta e chaves em **testnet.bybit.com** (separadas da conta real) e use `EXCHANGE_TESTNET=true`.
5. Stop de proteção: ordem **condicional** na própria Bybit (spot). **Ainda não foi testada ao vivo** — a API da Bybit respondeu 403 (bloqueio por região) no ambiente onde desenvolvi. Teste no testnet antes de usar dinheiro real.

### 5. Asaas (pagamentos) — comece no sandbox
1. Conta em sandbox.asaas.com → *Integrações → Chave de API* → `ASAAS_API_KEY`; `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`.
2. *Integrações → Webhooks*: URL `SEU_SITE/api/webhooks/asaas`, **token de autenticação** = o mesmo valor de `ASAAS_WEBHOOK_SECRET` (invente um longo), eventos de cobrança e de assinatura.
3. Repasse Pix: `OWNER_PIX_KEY` e `OWNER_PIX_KEY_TYPE`. O Asaas pode exigir **autorização da transferência**; nesse caso o repasse fica "aguardando autorização", você recebe e-mail e vê um alerta no Admin (aprove no Asaas).
4. Webhook precisa de endereço público: em testes locais use ngrok/cloudflared.

### 6. Resend (e-mails) — `RESEND_API_KEY`, e `EMAIL_FROM` com domínio verificado.
### 7. LLM (opcional) — `LLM_API_KEY` (Anthropic ou OpenAI). Sem ela o Analyst usa só a nota técnica.

## Publicar na internet

**Site → Vercel**
1. Importe o repositório; *Root Directory* = `apps/web`; ligue *Include source files outside of the Root Directory*.
2. Cadastre todas as variáveis do `.env.example` (menos `REDIS_URL`/`WEB_PORT`). Defina `CRON_SECRET` (o `vercel.json` já agenda o vigia a cada 5 min — em plano grátis a Vercel só aceita cron diário; use então um monitor externo chamando `/api/cron/watchdog` com `Authorization: Bearer CRON_SECRET`).
3. Em `NEXT_PUBLIC_APP_URL` coloque o endereço final do site.

**Worker (o robô 24h) — fora dos EUA** (a Binance bloqueia IPs americanos, erro HTTP 451)
- **Fly.io (Frankfurt):** `fly launch --no-deploy --copy-config` → `fly secrets set SUPABASE_URL=... SUPABASE_KEY=... REDIS_URL=... ENCRYPTION_KEY=... RESEND_API_KEY=... OWNER_EMAIL=... LLM_API_KEY=... (e demais)` → `fly deploy`. A região está em `fly.toml` (`fra`; alternativas `ams`, `sin`).
- **Railway (Europa):** novo projeto a partir do repositório (usa `railway.json` + `Dockerfile.worker`) → *Settings → Region* = **Europe West (Amsterdã)** → adicione um Redis e variáveis (o `REDIS_URL` vem do plugin).
- **Redis:** Upstash (grátis) ou o plugin do Railway.
- **Saúde:** o worker responde `GET /health` (200 = Redis ok e ciclo rodando nos últimos 3 min); as duas plataformas já usam isso para reiniciar. Se o worker parar, o vigia (`/api/cron/watchdog`) **manda e-mail ao dono** e o Admin mostra "Worker parado". Se a chave de API de um cliente falhar, o robô dele pausa e **cliente e dono recebem e-mail**.

## Validação de 30 dias (conta do dono)
1. Conecte **sua** conta Binance real em *Config* (use valor pequeno, ex.: o que você aceita perder), rode o backtest e ligue o robô — o dono pode operar em real mesmo sem estratégia aprovada.
2. No **Admin → Validação**, clique *Iniciar janela de 30 dias*. O painel compara, lado a lado, o resultado **real** com o **backtest do mesmo período e dos mesmos parâmetros** (acerto, fator de lucro, média por trade, resultado). Real muito pior que o backtest = a simulação é otimista.

## Pesquisa de estratégia
`research/` tem tudo: `download.ts` (dados), `engine.ts` + `strategies.ts` (simulador e 5 famílias), `run.ts select|test` (validação / teste final **uma vez**, travado em `results/test.lock.json`), `report.ts` (gera `RESEARCH.md`). Resultado: **0 aprovadas**. Para pesquisar de novo é preciso dados novos como novo teste final — repetir o mesmo teste invalida o método.

## Modos e flags (`.env`)
| Variável | Padrão | O que faz |
|---|---|---|
| `STRATEGY_APPROVED` | `false` | `true` só se a pesquisa aprovar uma estratégia. `false` = clientes sem modo real |
| `EXCHANGES_ENABLED` | `binance,bybit` | corretoras liberadas na tela (a 1ª é a padrão) |
| `EXCHANGE_TESTNET` | `false` | `true` = Binance/Bybit em testnet (`BINANCE_TESTNET` é o nome antigo) |
| `ENABLE_MERCADO_BITCOIN` | `false` | Mercado Bitcoin escondido (não dá para verificar permissão de saque da chave) |
| `OWNER_EMAIL` | — | vira dono no 1º login (exige senha + 2FA para o Admin) |
| `PREVIEW_PAGES` | `false` | só em desenvolvimento: libera `/preview/*` (dados de EXEMPLO) |

## Testes e verificação
```bash
npm install
npm test                 # núcleo (indicadores, backtest, AES, acesso) + RLS num Postgres real (PGlite)
npm run test -w @desk/worker   # Executor e Risk com corretora simulada
npm run typecheck
npx tsx scripts/e2e.ts --mock  # jornada: o que dá para rodar sem contas externas
npx tsx scripts/e2e.ts         # jornada completa em SANDBOX (exige as variáveis listadas no topo do arquivo)
```

## O que foi testado de verdade (e o que não foi)
| Item | Situação |
|---|---|
| Indicadores, backtest, AES-256-GCM, regras de acesso | ✅ testes automatizados (6) |
| **RLS no Postgres** (usuário A nunca vê dados de B; anônimo; dono sem/com 2FA; service_role) | ✅ 8 testes contra Postgres real (PGlite) rodando as migrations 001+002 |
| Executor + Risk (abrir, stop na corretora, alvo, trailing, limite diário, fechar todas, nunca preço médio, liga/pausa) | ✅ 13 testes com **corretora simulada** (não é a Binance de verdade) |
| Pesquisa de estratégia | ✅ executada com dados reais da Binance (3 anos) |
| Healthcheck do worker | ✅ testado com Redis real: 200 saudável / 503 sem Redis |
| Build do site, telas em 390px e 1440px (`docs/screenshots/`), sem rolagem horizontal | ✅ |
| **Ordens na Binance/Bybit Testnet** | ⚠️ código pronto (`EXCHANGE_TESTNET`), **não executado**: exige chaves suas |
| **Bybit** (validação de chave, stop condicional, fechamento) | ✅ lógica testada com corretora simulada (6 testes); ⚠️ **nunca falou com a Bybit de verdade** (API deu 403 no meu ambiente) |
| **Asaas sandbox** (assinatura, Pix, webhook, inadimplência, cancelamento, repasse) | ⚠️ código pronto, **não executado** (sem chave); nomes de campos da transferência pendente de autorização **não foram verificados** na API real |
| **Resend** (envio real) | ⚠️ templates prontos (`docs/email-preview.html`), envio **não testado** |
| **Supabase** na nuvem, login do dono com TOTP | ⚠️ **não testado** de ponta a ponta (RLS foi testado em Postgres local) |
| Docker (`docker compose up`, `Dockerfile.worker`) | ⚠️ não consegui rodar o daemon Docker no ambiente de desenvolvimento; instalação isolada do worker e o worker em si foram testados fora do Docker |

## Segurança
Webhook com token comparado em tempo constante e eventos idempotentes · acesso decidido no servidor (middleware + checagem em toda página/rota + RLS) · chaves AES-256-GCM, tabela de chaves sem nenhuma policy · chave com saque é recusada na Binance · dono exige 2FA (aal2) também nas policies RLS · auditoria de logins e ações do dono · nenhuma senha/e-mail fixo no código.

## Estrutura
```
apps/web      Next.js 15 (site, painel, admin, APIs, webhook)
apps/worker   BullMQ + Redis (6 agentes, relatórios, cobrança, repasse, /health)
packages/core indicadores, estratégia, backtest, CCXT, Asaas, Resend, LLM
research/     pesquisa de estratégia + RESEARCH.md
supabase/     migrations 001 e 002
scripts/      instalador Windows, e2e
docs/         screenshots, preview de e-mail
```
