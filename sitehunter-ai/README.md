# SiteHunter AI

**Encontre clientes. Crie sites. Venda mais.**

Plataforma SaaS para encontrar empresas brasileiras que possivelmente ainda não têm site, gerar sites com IA, editá-los sem código, publicá-los com HTTPS, preparar propostas comerciais e mensagens de abordagem. Assinatura Premium de **R$ 77/mês** via **Kiwify**.

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

## Desenvolvimento local

```bash
cp .env.example .env            # preencha DATABASE_URL e o que tiver
npm install
npx prisma migrate deploy       # cria as tabelas
npm run dev                     # http://localhost:3000
```

- Cadastre-se com um e-mail listado em `ADMIN_EMAILS` para virar administrador, ou rode `npm run db:seed -- seu@email.com`.
- Localmente, os sites ficam em `http://<slug>.localhost:3000` (Chrome/Firefox resolvem `*.localhost`) e também em `http://localhost:3000/s/<slug>`.
- Sem `ANTHROPIC_API_KEY`, a geração usa textos-modelo criados só com os dados reais da empresa, e a interface avisa isso.
- Sem SMTP, os e-mails (links de verificação e redefinição) aparecem no log do servidor.

## Testes

```bash
# Unitários + integração (PostgreSQL real; use um banco cujo nome termine em _test)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sitehunter_test npm test

# Ponta a ponta via HTTP contra um servidor rodando (npm run build && npm start)
BASE_URL=http://localhost:3000 KIWIFY_WEBHOOK_TOKEN=... npm run test:e2e
```

Cobertura: assinatura HMAC da Kiwify (com o vetor de teste oficial), idempotência de webhooks, vínculo de pagamentos, cancelamento, reembolso, vencimento, reativação, retenção, limites mensais sob concorrência, limite de sites publicados, isolamento entre usuários, bloqueio Premium no backend, CSRF, publicação e despublicação reais, subdomínios, PDF, exportação, renderização segura (XSS) e painel administrativo.
