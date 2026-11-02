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

## 4. Google Maps Platform (busca, mapa, endereços, rotas e mapa nos sites)

No Google Cloud Console, crie um projeto, ative o **faturamento** e ative estas APIs:

| API | Para quê | Chave |
|---|---|---|
| Places API (New) | Busca de empresas, dados e horários | Servidor |
| Geocoding API | "Pesquisar endereço" no painel | Servidor |
| Routes API | "Rota até a empresa" (carro, a pé, bicicleta, transporte público) | Servidor |
| Maps JavaScript API | Mapa interativo com marcadores no painel | Navegador |
| Maps Embed API | Mapa dentro dos sites publicados (gratuita) | Sites |

Crie **três chaves** em *APIs e serviços → Credenciais*, cada uma com restrições próprias:

1. **`GOOGLE_MAPS_SERVER_KEY`** (servidor)
   - Restrição de aplicativo: **Endereços IP**, com o IP do seu servidor.
   - Restrição de API: Places API (New), Geocoding API e Routes API.
   - Fica só no servidor e nunca é enviada ao navegador. O nome antigo `GOOGLE_PLACES_API_KEY` continua aceito.
2. **`GOOGLE_MAPS_BROWSER_KEY`** (mapa do painel)
   - Restrição de aplicativo: **Referenciadores HTTP**, com `https://app.SEUDOMINIO/*` (e `http://localhost:3000/*` para testes).
   - Restrição de API: Maps JavaScript API.
   - O painel busca essa chave em `/api/maps/config`, só para usuários logados; ela não fica embutida no código.
   - Uma chave de mapa no navegador sempre aparece para quem usa a página. Por isso a proteção é a restrição de domínio.
3. **`GOOGLE_MAPS_EMBED_KEY`** (mapa nos sites)
   - Restrição de aplicativo: **Referenciadores HTTP**, com `https://*.ROOT_DOMAIN/*` e cada domínio próprio de cliente que você conectar.
   - Restrição de API: Maps Embed API.
   - Ela aparece no HTML público dos sites, como em qualquer mapa incorporado; por isso a restrição de domínio é obrigatória.
   - Os sites exportados (.zip) não levam o mapa embutido, porque ficarão em outro domínio. Eles mantêm os botões de rota.

Opcional: **`GOOGLE_MAPS_MAP_ID`**. Crie um Map ID em *Map Management* para usar os marcadores avançados. Sem ele, o painel usa marcadores clássicos com o mesmo visual.

**Fotos do estabelecimento:** a busca já traz as referências de foto do Google (Places API New, mesma chave de servidor). Ao gerar o site, as fotos viram capa, “sobre”, imagens dos serviços/produtos e galeria com ampliação. O site pede `/api/place-photo/<empresa>/<n>?w=<largura>` e o servidor responde com um redirecionamento para a imagem na CDN do Google. A chave não aparece no HTML e nenhuma imagem é baixada ou armazenada; só a URL temporária fica em memória por 30 minutos. O autor de cada foto é creditado, como o Google exige. As fotos do Google são de quem as publicou (dono ou clientes). Para uso comercial, prefira fotos enviadas ou autorizadas pela empresa e troque-as no editor.

**O que aparece para o usuário:**
- **Buscar empresas:** lista e mapa lado a lado no computador, e abas Lista/Mapa no celular.
- **Marcadores coloridos:** azul = possivelmente sem site; roxo = só rede social; cinza = site informado; ponto verde = empresa já salva.
- **Pesquisar endereço:** centraliza o mapa e prioriza empresas num raio de 2 a 25 km.
- **Usar minha localização:** primeiro aparece uma tela explicando o uso, e só depois o navegador pede a permissão. Se a pessoa recusar, aparece uma mensagem explicando como liberar. Só funciona em HTTPS.
- **Painel da empresa:** dados, horários e rota calculada (tempo e distância), com o trajeto desenhado no mapa.
- **Erros:** chave ausente, recusada pelo Google, falha de rede ou demora mostram uma mensagem clara. A lista continua funcionando mesmo sem o mapa.

**Custos:** Places, Geocoding, Routes e Maps JavaScript são cobrados por uso (há uma cota mensal gratuita). A Maps Embed API é gratuita. Configure **alertas de orçamento** e **cotas por API** no Google Cloud.

**Termos do Google:** o `place_id` pode ser armazenado; outros dados têm restrições de cache, e dados do Places só podem ser exibidos em mapas do Google. A plataforma guarda a data da consulta, oferece "Atualizar dados", exibe a atribuição do Google e usa somente mapas do Google. Revise os [termos da Google Maps Platform](https://cloud.google.com/maps-platform/terms).

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
