# HEXADESK — robô de day trade na B3 (WIN/WDO) via MetaTrader 5

> **Foco atual: day trade de mini índice (WIN) e mini dólar (WDO) na B3, pela Clear, com o MetaTrader 5.**
> O código de cripto (Binance/Bybit, pasta `apps/web/app/app`, worker BullMQ) continua no repositório como **legado**, sem uso.
> **Comece por [`docs/B3-GUIA.md`](docs/B3-GUIA.md)**: conta Clear, MT5, conta DEMO, conector no seu PC e VPS.

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
- **Simulador é o padrão** (conta DEMO). **REAL** exige: (a) com estratégia aprovada: 20 pregões na demo do MT5 + 2 confirmações + `OPERAR REAL`; (b) **sem** estratégia aprovada (hoje): só o **modo REAL LIMITADO** (1 contrato, R$ 100/dia, 3 operações/dia, 1 posição por vez), com ≥ 5 pregões na demo do MT5, 3 confirmações e as frases `OPERAR REAL` + `EU ASSUMO O RISCO`; em ambos, trava local no conector. O conector **recusa** operar se o tipo da conta (demo/real) não bater com o modo.

### Estado desta versão (honesto)
| Item | Situação |
|---|---|
| Regras do motor (horário, feriados, rolagem, risco, stop, zeragem, PARAR TUDO, travas demo/real) | ✅ 34 testes com **MT5 simulado** (`npm run test:connector`) |
| Segurança do banco (só o dono com 2FA lê dados B3) | ✅ 16 testes de RLS em Postgres real (PGlite) |
| **Conector falando com um MT5 de verdade** | ⚠️ **NUNCA executado**: precisa de Windows + MT5 + conta demo (só você tem). Pode haver ajustes (modo de preenchimento da ordem, símbolos, stops na B3) |
| Nome do servidor `ClearInvestimentos-DEMO`, política de robôs e horário de zeragem da Clear | ⚠️ **não confirmados** (ver o guia) |
| **Estratégia** | ⚠️ só uma estratégia de teste (cruzamento de EMAs), **NÃO validada**. A pesquisa para WIN/WDO ainda não foi feita (aguardando o restante do pedido) |
| Modo REAL LIMITADO (liberação do dono): regras e tetos | ✅ 4 testes de regras + 5 do motor (tetos valem acima das configurações, nos dois lados); ⚠️ **nunca usado com dinheiro/MT5 real** |
| **Simulador interno** (mercado ARTIFICIAL, dinheiro fictício, sem MT5; sobe sozinho no Docker) | ✅ 7 testes (contabilidade, zeragem, horários, origem separada, PARAR TUDO, liga sozinho 1×); ⚠️ preços **inventados** — não provam nada |
| Painel B3 no navegador (telas com dados de exemplo em `docs/screenshots/b3-*.jpg`) | ✅ build e telas; ❌ não testado com o conector real |
| Alerta por e-mail se o conector cair no pregão | ✅ código (`/api/cron/watchdog`); exige Resend + agendador; **push no celular não implementado** |

> ## ⚠️ (cripto, legado) Leia antes de vender
> 1. **Nenhuma estratégia passou na pesquisa de validação** (`research/RESEARCH.md`: 5 famílias × 3 pares × 3 timeframes, 3 anos, walk-forward, teste final uma única vez). Por isso, `STRATEGY_APPROVED=false` e **clientes não conseguem ligar o robô em conta real**. Só funciona em *testnet* (dinheiro de mentira) e na **conta do dono**.
> 2. A estratégia padrão do app tem backtest real **negativo** (BTC/USDT 1h: −0,53% em 90 dias; −3,75% em 365 dias).
> 3. Vender uma "gestão automática de investimento" pode exigir registro/autorização (CVM) e tem regras do Código de Defesa do Consumidor. **Fale com um advogado antes de cobrar.**
> 4. Nada aqui foi testado com dinheiro real nem com as contas reais de Asaas/Resend/Supabase (ver "O que foi testado").

---

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
