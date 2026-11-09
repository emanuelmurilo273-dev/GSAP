# HEXADESK — robô de cripto com mesa de 6 agentes

Robô que opera cripto **na conta da corretora do próprio cliente** (nunca guardamos dinheiro). Seis agentes trabalham 24h: **Scout** (coleta) → **Filter** (filtra) → **Analyst** (nota 0–1) → **Executor** (ordem) → **Risk** (stop/alvo/limite diário) → **Logger** (registro).

> ## ⚠️ Leia antes de vender
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
| `BINANCE_TESTNET` | `false` | `true` = ordens na Binance Spot Testnet |
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
| **Ordens na Binance Testnet** | ⚠️ código pronto (`BINANCE_TESTNET`), **não executado**: exige chaves suas |
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
