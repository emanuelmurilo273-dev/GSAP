# Implantação e configuração

Infraestrutura recomendada: **um servidor (VPS) com Docker** (ex.: Hetzner, DigitalOcean, Contabo, AWS Lightsail; 2 vCPU e 4 GB de RAM bastam para começar). O `docker-compose.yml` sobe a aplicação, o PostgreSQL, o Caddy (HTTPS automático), a rotina horária e o backup diário.

## 1. Domínio e DNS

Escolha um domínio para a plataforma (ex.: `sitehunter.app`, o `ROOT_DOMAIN`) e crie no DNS, todos apontando para o IP do servidor:

| Registro | Nome | Valor | Uso |
|---|---|---|---|
| A | `@` | IP do servidor | landing page |
| A | `app` | IP do servidor | painel (`APP_URL=https://app.sitehunter.app`) |
| A | `*` | IP do servidor | sites publicados (`slug.sitehunter.app`) |
| A | `sites` | IP do servidor | destino do CNAME de domínios próprios |

> **Certificados:** o Caddy emite um certificado Let's Encrypt por subdomínio no primeiro acesso, e só para sites que existem (via `/api/domains/check`). O Let's Encrypt limita a **50 certificados novos por semana por domínio registrado**. Se você precisar de mais que isso, troque para um **certificado curinga** (`*.sitehunter.app`) com desafio DNS. Isso exige uma build do Caddy com o plugin do seu provedor de DNS (ex.: `caddy-dns/cloudflare`) e um bloco `*.sitehunter.app { tls { dns cloudflare {env.CF_API_TOKEN} } ... }`.

## 2. Servidor

```bash
git clone <repo> && cd sitehunter-ai
cp .env.example .env
# Preencha: APP_URL, ROOT_DOMAIN, CRON_SECRET (openssl rand -hex 32), ADMIN_EMAILS,
# POSTGRES_PASSWORD, ACME_EMAIL e as chaves das integrações abaixo.
docker compose up -d --build
docker compose logs -f app
```

As migrações do banco rodam automaticamente quando o container da aplicação inicia. Depois, acesse `APP_URL/cadastro` com um e-mail de `ADMIN_EMAILS`.

**Backups:** `./backups/sitehunter-AAAA-MM-DD.dump`, um por dia, mantidos por 14 dias. **Copie-os para fora do servidor** (ex.: `rclone` para S3 ou Backblaze B2). Para restaurar: `pg_restore -h ... -U sitehunter -d sitehunter --clean arquivo.dump`.

## 3. Kiwify (pagamentos)

Baseado na documentação oficial (`docs.kiwify.com.br/api-reference/webhooks`).

1. Crie na Kiwify um produto do tipo **assinatura** com cobrança **mensal de R$ 77**. A recorrência é feita pela própria Kiwify.
2. Copie o link de checkout e cole em **Admin → Configurações → URL do checkout** (ou em `KIWIFY_CHECKOUT_URL`).
3. Em **Apps → Webhooks → Criar webhook**:
   - **URL:** `https://app.SEUDOMINIO/api/webhooks/kiwify`
   - **Produto:** o produto de assinatura
   - **Eventos:** compra aprovada, compra recusada, compra reembolsada, chargeback, assinatura cancelada, assinatura atrasada, assinatura renovada, boleto gerado, pix gerado
   - **Token:** gere um valor aleatório e coloque o mesmo em `KIWIFY_WEBHOOK_TOKEN`
4. Use **“Testar webhook”** na Kiwify e confira em **Admin → Pagamentos → Últimas notificações**.

**Como funciona:** a Kiwify envia `?signature=` (HMAC-SHA1 do corpo bruto, com o token como chave). A aplicação valida a assinatura em tempo constante, rejeita com 401 se ela não bater, registra cada evento, deduplica reenvios e aplica o estado da assinatura (`customer_access.access_until` / `next_payment` definem o fim do período). Se o processamento falhar, a resposta é 500 e a Kiwify reenvia depois.

**Vínculo pagamento → conta:** (1) parâmetro de rastreio `sck` com uma referência opaca da conta, adicionado ao link do checkout; (2) id da assinatura já conhecido; (3) e-mail do comprador igual ao e-mail da conta. Pagamentos sem conta ficam em **Admin → Pagamentos** para vincular manualmente e são vinculados automaticamente se a pessoa se cadastrar depois com o mesmo e-mail.

**Limitações conhecidas (Kiwify):**
- A API pública da Kiwify **não tem endpoint de assinaturas**. O estado vem apenas dos webhooks, e não existe ambiente de testes (sandbox).
- A documentação não detalha os campos internos de `Customer`, `Commissions` e `TrackingParameters`. O código lê `Customer.email`, `TrackingParameters.sck` e valores de `Commissions` de forma defensiva. **Confirme com um pagamento real** que o e-mail chega. Se os valores em R$ não vierem, o painel admin avisa e mostra “—” em vez de inventar números.
- Não confirmamos na documentação se o checkout aceita pré-preenchimento de e-mail nem se repassa o `sck` ao webhook. Por isso a tela de assinatura pede para usar o mesmo e-mail da conta.
- Não há proteção contra *replay* no protocolo da Kiwify (a assinatura não inclui data/hora). A deduplicação por evento reduz o impacto.

## 4. Google Places API (busca de empresas)

1. No Google Cloud Console, crie um projeto, ative o **faturamento** e a **Places API (New)**.
2. Crie uma chave de API e restrinja: *Application restrictions* = endereços IP do servidor; *API restrictions* = Places API (New).
3. Defina `GOOGLE_PLACES_API_KEY`.
4. Custos: Text Search com campos de contato (telefone/site) é cobrado na faixa “Enterprise”. Acompanhe o painel de faturamento do Google e ajuste o limite de pesquisas por assinante em **Admin → Configurações**.
5. **Termos do Google:** o `place_id` pode ser armazenado; outros conteúdos têm restrições de cache, e dados do Places não devem ser exibidos em mapas de outros provedores. A plataforma guarda a data da consulta, oferece “Atualizar dados” (Place Details), exibe a atribuição “Dados de empresas: Google” e usa apenas links do Google Maps. Revise os [termos da Google Maps Platform](https://cloud.google.com/maps-platform/terms) para o seu caso de uso.

## 5. IA (Anthropic Claude)

1. Crie uma chave em `console.anthropic.com` e defina `ANTHROPIC_API_KEY`.
2. Modelo padrão: `claude-opus-5-5` (`AI_MODEL`). As chamadas usam saída estruturada (JSON Schema) e *fallback* automático do servidor em caso de recusa.
3. Os prompts proíbem inventar depoimentos, avaliações, preços, horários, certificações etc. Os dados da empresa entram como dados (não instruções).

## 6. Unsplash (opcional)

Crie um app em `unsplash.com/developers` e defina `UNSPLASH_ACCESS_KEY`. A plataforma faz *hotlink* das fotos, mostra o crédito do fotógrafo e registra o download, conforme as diretrizes da API. Para produção acima de 50 req/h, solicite aprovação do app no Unsplash.

## 7. E-mail (SMTP)

Defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` (ex.: Amazon SES, Resend, Brevo, Mailgun). Com `REQUIRE_EMAIL_VERIFICATION=true`, os recursos Premium exigem e-mail confirmado.

## 8. Domínios próprios dos clientes

No editor → **Publicar → Domínio próprio**, o assinante informa `www.empresa.com.br` e cria no DNS da empresa um **CNAME para `sites.ROOT_DOMAIN`**. Depois de **Verificar DNS**, o Caddy emite o certificado no primeiro acesso. Para domínios raiz (sem `www`), use um registro A com o IP do servidor e defina `PUBLIC_SERVER_IPS`.

## 9. Lista final antes de lançar

- [ ] Revisar com um advogado os **Termos de Uso** e a **Política de Privacidade** (`/termos`, `/privacidade`) e incluir razão social, CNPJ, foro e contato do encarregado (DPO).
- [ ] Fazer uma compra real de teste na Kiwify e conferir: liberação do acesso, e-mail recebido no payload, valores em Admin → Pagamentos, cancelamento e reembolso.
- [ ] Configurar a cópia dos backups para fora do servidor e testar uma restauração.
- [ ] Definir alertas de faturamento no Google Cloud e na Anthropic.
- [ ] Garantir que o preço do produto na Kiwify e o preço exibido (Admin → Configurações) sejam iguais.
