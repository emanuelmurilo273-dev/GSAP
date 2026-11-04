# SiteHunter AI

**Encontre clientes. Crie sites. Venda mais.**

Plataforma SaaS para encontrar empresas brasileiras que possivelmente ainda não têm site, gerar sites com IA, editá-los sem código, publicá-los com HTTPS, preparar propostas comerciais e mensagens de abordagem. Assinatura Premium de **R$ 77/mês** via **Kiwify**.

- **Estúdio de leads** (descoberta → verificação → prévia → abordagem): ver [Estúdio de leads](#estúdio-de-leads) abaixo
- Guia de implantação e configuração das integrações: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Status de cada funcionalidade: [`docs/STATUS.md`](docs/STATUS.md)

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend + backend | Next.js 15 (App Router, rotas de API), React 19, TypeScript |
| Estilo | Tailwind CSS 4 (tema escuro preto/azul) |
| Banco de dados | PostgreSQL + Prisma ORM |
| Autenticação | Própria: senha com bcrypt, sessão em cookie HttpOnly (token aleatório, só o hash SHA-256 fica no banco), tokens de uso único para verificação de e-mail e redefinição de senha |
| IA | Anthropic Claude (`@anthropic-ai/sdk`, saída estruturada em JSON validada com Zod) |
| Empresas | Google Places API (New): Text Search e Place Details |
| Imagens | Unsplash API (opcional, com crédito ao fotógrafo) |
| Pagamentos | Kiwify: checkout + webhooks com assinatura HMAC-SHA1 |
| Hospedagem dos sites | Mesma aplicação, roteamento por domínio (`<slug>.ROOT_DOMAIN` e domínios próprios) atrás do **Caddy** com HTTPS automático (on-demand TLS) |
| Infra | Docker Compose: app, PostgreSQL, Caddy, rotina horária e backup diário |

### Como a publicação funciona

1. **Salvar** grava o rascunho (JSON validado) e cria uma versão no histórico (até 30 versões, com restauração).
2. **Publicar/Atualizar site** gera um *snapshot* HTML estático e seguro (todo texto escapado, URLs validadas, CSP restritiva) e o grava em `Publication`.
3. O middleware reconhece `slug.ROOT_DOMAIN` (ou um domínio próprio verificado) e serve o snapshot. A cada acesso o servidor **confere se a assinatura do dono está ativa**. Se não estiver, mostra “site temporariamente indisponível” (HTTP 503).
4. O Caddy só emite certificados SSL para domínios que a aplicação confirma em `/api/domains/check`.
5. O cookie de sessão é exclusivo do domínio do painel, então os sites publicados nunca o recebem.

### Regras de assinatura (aplicadas no backend)

| Situação | Acesso Premium | Sites publicados |
|---|---|---|
| Ativa | Sim | No ar |
| Renovação cancelada | Sim, até o fim do período pago | No ar até o fim do período |
| Vencida (+ carência configurável) | Suspenso | Fora do ar (página de indisponibilidade) |
| Reembolso / chargeback | Revogado na hora | Fora do ar |
| Pagamento confirmado depois | Reativado automaticamente | Voltam ao ar (dentro do limite do plano) |
| Suspensa há mais que a retenção (30 dias, configurável) | — | Projetos excluídos. Conta e registros de pagamento são mantidos |

A regra está em um único lugar (`src/lib/access.ts`) e é usada pelas APIs, pelas páginas, pelo servidor de sites e pela rotina periódica.

## Estúdio de leads

Fluxo em `/app/leads`: o usuário informa **nicho, cidade/região, idioma e quantidade** (até 30). O sistema descobre empresas, normaliza e deduplica, verifica a presença digital pública, registra a fonte e a confiança de cada dado e aponta oportunidades. No perfil do lead (`/app/leads/[id]`) o usuário revisa e corrige os dados, gera a **prévia do site** (sempre marcada como não publicada) e prepara a **abordagem comercial** (assunto + mensagem, em português e no idioma do lead) para copiar ou exportar. **Nada é enviado, publicado ou contatado automaticamente.**

### Módulos

| Módulo | Arquivos |
|---|---|
| Interface | `src/app/app/leads/*`, `src/components/leads/*`, `src/components/studio/*` (cena 3D em CSS, cartões com profundidade, moldura 3D, assistente do Flow) |
| Provedores de dados | `src/lib/leads/providers/`: `googlePlaces.ts` (real), `csvImport.ts` (dados do usuário), `demo.ts` (fictício). Interface comum `BusinessSearchProvider` |
| Presença digital | `src/lib/leads/presence.ts` (lê só a página inicial pública), `robots.ts` (RFC 9309), `safeFetch.ts` (bloqueio de IPs privados/SSRF, limites de tempo e tamanho, redirecionamentos conferidos) |
| Normalização / deduplicação | `src/lib/leads/normalize.ts` (chaves por domínio, telefone, nome+cidade, perfil social; demo nunca se compara com real) |
| Proveniência e oportunidades | `src/lib/leads/facts.ts`, `opportunities.ts`, `verified.ts` |
| Conteúdo e prompts | `src/lib/leads/outreach.ts` (modelos pt-BR/en/es + IA opcional), `src/lib/ai.ts` |
| Google Flow | `src/lib/flow.ts` + `src/components/studio/FlowAssistant.tsx` (fluxo assistido, ver abaixo) |
| Sites / prévia | `src/lib/site/*` (origem/licença por imagem, faixa “prévia não publicada”, aviso em imagens geradas) |
| Armazenamento | Prisma: `LeadSearch`, `OutreachDraft` e os novos campos de `Company` (`facts`, `presence`, `opportunities`, `dedupeKeys`, `isDemo`, `excludedAt`…) |

### Regras de dados

- Cada campo guarda `{ value, status, source, sourceUrl, confidence, collectedAt, note }`, com `status` igual a **confirmed** (fonte pública), **inferred** (dedução, ex.: “a fonte não informa site”), **not_found** ou **user** (revisado pelo usuário).
- O site e a abordagem usam **somente** fatos `confirmed` ou `user`. Inferências nunca viram afirmação.
- A verificação do site só acontece depois do robots.txt (`User-agent: SiteHunterBot`, página pública em `/bot`), não segue links e coleta apenas e-mails comerciais genéricos (`contato@`, `atendimento@`…), para evitar dados pessoais.
- Leads de demonstração têm nome com “(demo)”, endereço “fictício”, telefone `(00)` e domínio `example.com`. São marcados como DEMO em toda a interface, nos rascunhos e na prévia.
- Imagens guardam origem (`stock`, `company`, `generated`, `user`), licença ou condição de uso, URL de origem e texto alternativo. Imagens geradas sempre aparecem no site com o aviso “imagem ilustrativa gerada por IA”. Imagens do site da empresa só entram com a confirmação de autorização.

### Google Flow

Em nov/2026 não há API pública oficial do Google Flow: ele é uma ferramenta de interface dos planos Google AI Pro/Ultra/Workspace. Veo e Imagen têm APIs próprias (Gemini API/Vertex AI), mas isso não é o Flow. Por isso a integração é **assistida**: o editor gera um pacote de prompt (sem nome, fachada, logotipo ou pessoas reais), o usuário gera a imagem no Flow, hospeda o arquivo, cola a URL e passa por uma checagem obrigatória antes de inserir. **O sistema não gera imagens e não afirma ter gerado.**

### Rotas de API novas

`POST/GET /api/leads/searches` · `GET /api/leads/providers` · `GET /api/leads` · `GET/PATCH/DELETE /api/leads/[id]` · `POST /api/leads/[id]/reanalyze` · `GET/POST /api/leads/[id]/outreach` · `PATCH/DELETE /api/outreach/[id]` · `GET /api/outreach/[id]/export?format=txt|md`

## Desenvolvimento local

```bash
cp .env.example .env            # preencha DATABASE_URL e o que tiver
npm install
npx prisma migrate deploy       # cria as tabelas
npm run dev                     # http://localhost:3000
```

- Cadastre-se com um e-mail listado em `ADMIN_EMAILS` para virar administrador, ou rode `npm run db:seed -- seu@email.com`.
- Localmente, os sites ficam em `http://<slug>.localhost:3000` (Chrome/Firefox resolvem `*.localhost`) e também em `http://localhost:3000/s/<slug>`.
- **Sem nenhuma chave** dá para testar o fluxo inteiro: em Estúdio de leads, escolha **Demonstração** (dados fictícios, marcados) ou **Importar** (CSV seu). A busca real exige `GOOGLE_PLACES_API_KEY` e assinatura ativa (administradores têm acesso).
- Sem `ANTHROPIC_API_KEY`, a geração usa textos-modelo criados só com os dados reais da empresa, e a interface avisa isso.
- Sem SMTP, os e-mails (links de verificação e redefinição) aparecem no log do servidor.

## Testes

```bash
# Unitários + integração (PostgreSQL real; use um banco cujo nome termine em _test)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sitehunter_test npm test

# Ponta a ponta via HTTP contra um servidor rodando (npm run build && npm start)
BASE_URL=http://localhost:3000 KIWIFY_WEBHOOK_TOKEN=... npm run test:e2e
```

Cobertura do estúdio de leads (`tests/leads.*.test.ts`): normalização e deduplicação, robots.txt, análise de HTML, proveniência, oportunidades, abordagem sem fatos inventados (pt/en/es), CSV, bloqueio de SSRF, aviso de imagens geradas, pipeline demo/importação/Google Places simulado, isolamento entre contas e separação demo × real.

Cobertura: assinatura HMAC da Kiwify (com o vetor de teste oficial), idempotência de webhooks, vínculo de pagamentos, cancelamento, reembolso, vencimento, reativação, retenção, limites mensais sob concorrência, limite de sites publicados, isolamento entre usuários, bloqueio Premium no backend, CSRF, publicação e despublicação reais, subdomínios, PDF, exportação, renderização segura (XSS) e painel administrativo.
