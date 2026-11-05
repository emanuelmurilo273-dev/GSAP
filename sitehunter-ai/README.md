# SiteHunter AI

**Encontre clientes. Crie sites. Venda mais.**

Plataforma SaaS para encontrar empresas brasileiras que possivelmente ainda não têm site, gerar sites com IA, editá-los sem código, publicá-los com HTTPS, preparar propostas comerciais e mensagens de abordagem. Assinatura Premium de **R$ 77/mês** via **Kiwify**.

- **Estúdio de leads** (descoberta → verificação → prévia → abordagem): ver [Estúdio de leads](#estúdio-de-leads) abaixo
- Guia de implantação e configuração das integrações: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Status de cada funcionalidade: [`docs/STATUS.md`](docs/STATUS.md)

## Início rápido (uso pessoal, no seu computador)

**Requisitos:** Node.js 22+ e PostgreSQL 16 (ou Docker). Nenhuma chave de API é obrigatória para começar: a busca real usa o OpenStreetMap e as imagens com licença vêm do Openverse.

1. Baixe o código e instale as dependências:
   ```bash
   git clone -b claude/funny-hopper-0mr6uu https://github.com/emanuelmurilo273-dev/GSAP.git
   cd GSAP/sitehunter-ai
   npm install
   ```
2. Crie um banco PostgreSQL (exemplo com Docker):
   ```bash
   docker run -d --name sitehunter-db -e POSTGRES_USER=sitehunter -e POSTGRES_PASSWORD=sitehunter -e POSTGRES_DB=sitehunter -p 5432:5432 postgres:16
   ```
3. Configure o ambiente: `cp .env.example .env` e preencha no mínimo:
   ```env
   DATABASE_URL="postgresql://sitehunter:sitehunter@localhost:5432/sitehunter"
   APP_URL="http://localhost:3000"
   ROOT_DOMAIN="localhost:3000"
   ACCESS_MODE="private"
   OWNER_EMAIL="voce@seudominio.com.br"
   OSM_CONTACT_EMAIL="voce@seudominio.com.br"   # exigido pela política de uso do OpenStreetMap
   ```
4. Crie as tabelas e a sua conta (a senha é pedida no terminal, mínimo de 12 caracteres):
   ```bash
   npx prisma migrate deploy
   npm run owner:create -- voce@seudominio.com.br "Seu nome"
   ```
   Com Docker Compose (servidor): `docker compose exec -it app node scripts/owner.mjs voce@seudominio.com.br "Seu nome"`.
5. Inicie: `npm run build && npm start` (ou `npm run dev` para desenvolvimento) e abra http://localhost:3000. Entre com o e-mail e a senha do passo 4. Não existe cadastro público.

### Como usar

1. **Estúdio de leads** → aba **OpenStreetMap** (ou **Google Maps**, se configurado) → informe o ramo (ex.: "barbearia", "dentista"), escolha o **estado** e a **cidade** (qualquer um dos 5.570 municípios, com autocompletar; também aceita digitar "Chapecó - SC") → **Iniciar busca de leads**. Depois da busca o app mostra a cobertura real da fonte e avisa quando a cidade não retornou resultados. O app busca as empresas, remove duplicadas, verifica o site público de cada uma (respeitando o robots.txt) e registra a fonte e a confiança de cada dado.
2. **Abrir perfil** de um lead: revise os dados (selos *Confirmado*, *Inferência*, *Não encontrado*, *Revisado por você*), corrija o que precisar e veja as oportunidades.
3. **Imagens para o site**: aprove imagens publicadas pela própria empresa (só com a sua confirmação de autorização) ou busque e adicione imagens de banco com licença. As aprovadas entram no site; se faltarem, a geração completa com fotos CC0 atuais, sempre com crédito.
4. Marque **Revisei os dados** → **Gerar prévia do site**. O editor abre com a prévia animada em 3D. A direção visual vem do setor e pode ser trocada na aba Design. Revise as notas em amarelo, os textos, as imagens, os horários e os números.
5. **Publicar**: a prévia começa privada. **Liberar link público…** pede confirmação e libera só aquela página (`/s/<endereço>`). **Retirar acesso público** derruba o link na hora.
6. **Abordagem por WhatsApp** (no perfil do lead): quando a empresa publicou um WhatsApp comercial (link `wa.me` no site oficial ou tag `contact:whatsapp` no OpenStreetMap), o painel mostra uma mensagem curta, editável, montada só com fatos verificados, e a prévia em forma de balão. **Abrir no WhatsApp para revisar** abre `https://wa.me/NÚMERO?text=…` com o texto preenchido; quem toca em enviar é você. Se a prévia estiver publicada, o link entra na mensagem como sugestão; se não, a mensagem só oferece enviar o link. Sem WhatsApp confirmado, não há botão: o painel pede para você **confirmar** o celular publicado (quando há um) ou **adicionar** um número que você conferiu.
7. **Abordagem comercial** (e-mail): **Gerar rascunho** cria assunto e mensagem em português e no idioma do lead. Edite, copie e envie você mesmo. O app nunca envia nada.

### O que funciona sem configuração e o que depende de conta ou chave

| Recurso | Situação | Configuração |
|---|---|---|
| Lista de **todos os municípios do Brasil** (5.570 + DF, código IBGE, UF, coordenadas e DDD) | ✅ embutida no app (lista "municipios-brasileiros", MIT, derivada do IBGE); não depende de outra API | — |
| Busca real de empresas no **OpenStreetMap** (nome, categoria, endereço, telefone, e-mail, site, redes e horários quando cadastrados) | ✅ funciona sem chave em qualquer cidade, buscando dentro da área do município; testado com buscas reais em Curitiba/PR, Chapecó/SC, Porto Alegre/RS, Belo Horizonte/MG, São Paulo/SP, Salvador/BA, Natal/RN, Manaus/AM e Santana/AP. A cobertura depende de voluntários e varia muito por cidade | `OSM_CONTACT_EMAIL` (recomendado). Limite de 1 consulta/s; para volume maior use `NOMINATIM_URL` com instância própria |
| Busca real no **Google Maps (Places API New)**, com horários | 🔑 depende de chave paga do Google | `GOOGLE_PLACES_API_KEY`, com "Places API (New)" ativada no Google Cloud |
| Verificação do site público de cada lead (HTTPS, celular, ano, contatos, redes, imagens) | ✅ funciona | só a página inicial, após o robots.txt |
| Imagens com licença: **Openverse** (CC0/CC BY/CC BY-SA, uso comercial e modificação) | ✅ funciona sem chave (limite por IP) | `OPENVERSE_TOKEN` opcional para limite maior |
| Fotos reais com licença livre do **Wikimedia Commons** (busca pelo nome da empresa e fotos tiradas perto do endereço que citam o nome) | ✅ funciona sem chave; entram como candidatas para você aprovar, com autor e licença | — |
| Imagens com licença: **Unsplash** | 🔑 chave gratuita | `UNSPLASH_ACCESS_KEY` (quando definida, substitui o Openverse) |
| Imagens dos canais da própria empresa: site oficial | ✅ coletadas da página inicial (og:image e fotos grandes); só entram com a sua confirmação de autorização | — |
| Fotos publicadas pela empresa no **Google Maps** (autor = o próprio estabelecimento) | 🔑 depende da chave do Google; fotos de clientes nunca são usadas. O link do Google pode expirar, então para publicar o ideal é pedir o arquivo original | `GOOGLE_PLACES_API_KEY` |
| Fotos de Instagram/Facebook | ❌ não coletadas: exigem login e os termos dessas redes proíbem coleta automática. Peça as fotos à empresa e adicione-as no editor | — |
| WhatsApp comercial: detecção (link `wa.me` no site oficial, tag do OSM) e botão com mensagem pronta | ✅ funciona; sem confirmação, o botão não aparece e o app pede para você confirmar ou adicionar | — |
| **Google Flow** | ⚠️ sem API pública oficial: fluxo assistido (prompt pronto, você gera no Flow, importa e revisa). Nada é gerado automaticamente | — |
| Textos do site e da abordagem com **IA (Claude)** | 🔑 opcional; sem chave usa textos-modelo sinalizados | `ANTHROPIC_API_KEY` |
| Sites com direções visuais, 3D, animações ao rolar, modo leve e movimento reduzido | ✅ funciona | — |
| Painel privado só do proprietário | ✅ funciona | `ACCESS_MODE=private`, `OWNER_EMAIL`, `npm run owner:create` |
| Link público por prévia | ✅ funciona em `/s/<endereço>`; subdomínios exigem DNS curinga e HTTPS (ver `docs/DEPLOY.md`) | `ROOT_DOMAIN`, Caddy |
| E-mails de recuperação de senha | 🔑 opcional; sem SMTP o link aparece no log do servidor | `SMTP_*` |

**Imagens nos sites:** fotos da empresa aparecem com "Foto da empresa · fonte"; fotos de banco sempre com "Imagem ilustrativa · Foto: autor · licença"; imagens geradas com "Imagem ilustrativa gerada por IA". Nada de banco ou IA é apresentado como foto do negócio.

**Limites honestos:** a cobertura do OpenStreetMap varia por cidade (muitos comércios não têm telefone ou horário cadastrados). O Google Maps tem cobertura maior, mas é pago. Fotos de contribuidores do Google Maps não são reutilizadas, porque os direitos são dos autores. O modo **Demonstração** gera empresas fictícias, sempre marcadas como DEMO.

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

## Acesso privado (conta proprietária)

Por padrão (`ACCESS_MODE=private`) o produto é de uso exclusivo do proprietário:

- **Sem cadastro público.** `POST /api/auth/register` responde 403 e a página de cadastro mostra que está desativado.
- **Conta proprietária pela linha de comando:** `npm run owner:create -- voce@dominio.com "Seu nome"` (senha pedida sem eco ou via `OWNER_PASSWORD`, mínimo 12 caracteres; trocar a senha encerra todas as sessões).
- **Controle no servidor:** `getCurrentUser()` só devolve a conta proprietária (`role=ADMIN` e, se definido, `OWNER_EMAIL`). Toda página e API passa por ele, então outra conta com sessão válida é tratada como não autenticada. O login dá a mesma resposta genérica para senha errada e para conta não autorizada, e a recuperação de senha só envia e-mail ao proprietário.
- **Camada extra no middleware:** sem cookie de sessão, só passam as rotas públicas de `src/lib/publicPaths.ts` (login, recuperação de senha, webhooks, health e os sites publicados em `/s/…`). APIs respondem 401 e páginas redirecionam para `/login`. A página inicial redireciona para o painel ou para o login.
- `ACCESS_MODE=saas` restaura o modo multiusuário com assinatura.

## Prévias privadas e links públicos

Cada prévia nasce **privada**: existe só dentro do painel, com a faixa "Prévia não publicada". Na aba **Publicar** do editor, o cartão **Visibilidade** mostra o estado (🔒 Prévia privada / ● Site público):

- **Liberar link público…** abre uma confirmação que lista o que fica público (somente aquela página) e o que continua privado. A API exige `confirmPublic: true`.
- O site público é um **snapshot HTML** servido em `<slug>.ROOT_DOMAIN` ou `/s/<slug>`. Ele recebe `Content-Security-Policy: sandbox allow-scripts…` (sem `allow-same-origin`), então roda em origem opaca e não lê cookies nem chama APIs do painel, mesmo no caminho `/s/`. Também recebe `X-Robots-Tag: noindex, nofollow`.
- **Retirar acesso público** pede confirmação e o link passa a responder 404 na hora. A prévia continua salva e privada.
- Nada é publicado automaticamente: gerar uma prévia nunca cria um link público.

## Vitrine 3D sob medida (padrão das novas prévias)

Cada prévia nova recebe um **conceito próprio** (`src/lib/site/immersive/concept.ts`), montado a partir do que foi pesquisado sobre a empresa:

- **Objeto 3D**: vem do ramo (categoria na fonte) e do nome. Exemplos: "Implantes" vira implante, uma pizzaria vira pizza, e "Barbershop Cafe" ganha tesoura com xícara.
- **Paleta escura, material, tipografia, composição, movimento e motivo de fundo**: variam com o nome, então duas barbearias não saem iguais (há teste para isso).
- **Dados da empresa**: bairro e cidade vão para a abertura, horários publicados viram um capítulo com destaque ("Abre aos domingos"), e a descrição do site oficial vira o "Sobre".
- **Transparência**: o editor mostra **por que** cada escolha foi feita, permite trocar objeto, material, cor e palavra de fundo, e gerar outra variação.

A página (`src/lib/site/immersive/render.ts` + `runtime.ts`) segue a referência do relógio:

- **Objeto e cena**: fundo escuro e um objeto 3D real em three.js (r128, MIT, servido pelo próprio app em `/vendor/three.min.js`), com 32 modelos procedurais e reflexos reais de um estúdio de luz.
- **Rolagem**: capítulos fixos enquanto o objeto muda de posição, ângulo e escala; objetos secundários entram vindos do fundo; partículas, anéis, grade ou fitas dão profundidade; as fotos aparecem em cartões com perspectiva.
- **Leitura e acessibilidade**: textos e botões são HTML comum, legíveis sobre faixas escuras, e os títulos encolhem para caber.
- **Celular**: objeto no alto, texto embaixo.
- **Movimento reduzido**: poses fixas sem giro.
- **Sem WebGL**: mostra a arte estática.
- **Aviso**: o rodapé informa que o objeto 3D é ilustrativo.

Exportação em ZIP leva o three.js junto. As direções clássicas abaixo continuam disponíveis no editor.

## Direções visuais clássicas

Os sites gerados não usam um template único. `src/lib/site/styles.ts` define 6 direções clássicas (além da Vitrine 3D); cada uma muda a estrutura da capa, a composição das seções, a tipografia, a base de cores, os botões e os ornamentos:

| Direção | Para | Capa e composição | 3D |
|---|---|---|---|
| Palco cinematográfico | barbearias, academias, oficinas | palco preto, brilho na cor da marca sob o objeto central, palavra gigante ao fundo com parallax, textos que entram desfocados, seletor de serviços que troca o destaque e a cor do brilho, contato em formato de ficha técnica | objeto central inclina com o ponteiro |
| Ateliê editorial | salões, moda, estética | serifa grande, imagem em moldura de arco, serviços como índice com linhas finas | palco 3D suave |
| Oficina em alto contraste | construtoras e serviços pesados | capa escura cheia, tipografia condensada enorme, faixa diagonal com os serviços | cartões com profundidade |
| Clínica serena | odontologia, clínicas | clara, cantos suaves, contatos confirmados em destaque logo abaixo da capa | palco 3D discreto |
| Casa artesanal | restaurantes, padarias | capa centralizada com formas orgânicas, cardápio com linhas pontilhadas | não |
| Estúdio contemporâneo | serviços, imobiliárias, pet shops | grade em blocos, pilha de cartões em perspectiva na capa | pilha que segue o ponteiro |

**Palco 3D ligado à rolagem** (inspirado no vídeo de referência): em todas as direções, um objeto que representa o negócio fica fixo na tela e muda de posição, ângulo e escala conforme a pessoa rola, enquanto serviços, números confirmados e o horário entram em sequência, com brilho que alterna entre as cores da marca. O objeto é escolhido pelo setor (prato, pão, tesoura, dente, halter, roda, tênis, pata, casa, secador, engrenagem…). Quando há foto real aprovada (da empresa ou de banco com licença), ela vira um painel 3D com espessura e brilho, só emoldurada e inclinada, nunca editada. Sem foto, entra uma ilustração vetorial em relevo, feita de camadas. Na direção cinematográfica o palco é a própria capa; nas demais ele substitui a seção de serviços (no restaurante, entra antes do cardápio). Sem script ou com movimento reduzido, tudo aparece como blocos normais. No celular e em aparelhos fracos, o objeto fica no alto e o texto embaixo, com menos camadas e sem desfoque. A aba Design do editor permite trocar o objeto, usar sempre a ilustração ou desligar o palco.

O setor sugere a direção, e o editor permite trocar (aba Design). Todas as direções têm entradas ao rolar (mais marcadas na cinematográfica, discretas nas sóbrias) e a seção opcional **Destaques em números**, com números que contam até o valor: ela fica oculta até você preencher valores confirmados pela empresa (o campo "fonte da confirmação" fica só no painel). Sem script, todo o conteúdo aparece normalmente. Sem foto, cada direção usa uma composição gráfica própria em vez de deixar espaços vazios. O texto dos botões é escolhido pelo contraste com a cor, cores de destaque usadas como texto são escurecidas ou clareadas até ficarem legíveis, e o editor avisa quando o contraste fica baixo. O 3D e o movimento respeitam `prefers-reduced-motion` e são desligados em telas de toque.

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
