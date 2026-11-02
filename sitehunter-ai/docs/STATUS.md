# Status das funcionalidades

Legenda: ✅ implementado e testado · 🔑 implementado, depende de credenciais externas · 🧪 implementado, precisa de validação com conta real · 🚧 requer desenvolvimento adicional

## Contas e segurança
| Item | Status |
|---|---|
| Cadastro, login, logout, sessões (cookie HttpOnly, hash do token) | ✅ |
| Recuperação de senha (token de uso único, 1 h; encerra sessões) | ✅ (envio real 🔑 SMTP) |
| Verificação de e-mail (opcionalmente obrigatória) | ✅ (envio real 🔑 SMTP) |
| Papéis Administrador / Assinante, verificados no servidor | ✅ |
| Isolamento de dados entre usuários (todas as consultas filtram por `userId`) | ✅ testado |
| Proteção CSRF (checagem de Origin), validação Zod, limitação de requisições no PostgreSQL | ✅ |
| CSP restritiva nos sites publicados; HTML escapado; URLs validadas | ✅ testado |
| Logs estruturados + trilha de auditoria (`AuditLog`) | ✅ |
| LGPD: exportar dados (JSON), excluir conta, política de privacidade e termos | ✅ (textos são modelo — revisar com advogado) |
| Autenticação em dois fatores | 🚧 |

## Busca de empresas
| Item | Status |
|---|---|
| Filtros país (Brasil), estado, cidade (lista do IBGE), bairro, segmento, nome | ✅ |
| Resultados reais via Google Places (nome, categoria, endereço, telefone, site, mapa) | 🔑 `GOOGLE_PLACES_API_KEY` |
| Filtro “Possivelmente sem site”, com aviso de que não é uma afirmação | ✅ |
| Identifica empresas que só informam rede social | ✅ |
| Salvar empresas, anotações, atualizar dados pela fonte (inclui horários reais) | ✅ / 🔑 |
| Mapa interativo com marcadores personalizados, seleção e legenda | 🔑 `GOOGLE_MAPS_BROWSER_KEY` (Maps JavaScript API) |
| Pesquisar endereço e busca num raio ao redor do ponto | 🔑 `GOOGLE_MAPS_SERVER_KEY` (Geocoding API) |
| Geolocalização com explicação prévia e mensagens de erro claras | ✅ (requer HTTPS) |
| Rotas (carro, a pé, bicicleta, transporte público) desenhadas no mapa | 🔑 `GOOGLE_MAPS_SERVER_KEY` (Routes API) |
| Nenhum dado inventado (sem chave → mensagem clara, a pesquisa não é contada) | ✅ testado |

## Sites
| Item | Status |
|---|---|
| “Criar site com IA” com 6 modelos (restaurante, barbearia/salão, clínica, oficina, loja, serviços) e 13 segmentos | ✅ (IA real 🔑 `ANTHROPIC_API_KEY`; sem chave usa textos-modelo sinalizados) |
| Proibição de depoimentos, avaliações, preços e horários inventados (prompt + modelo deixa preços e horários em branco) | ✅ |
| Imagens de banco autorizado com crédito | 🔑 `UNSPLASH_ACCESS_KEY` (ou URL própria) |
| Editor: textos, imagens, cores, fontes, seções (adicionar, remover, ocultar, reordenar), botões, links, prévia celular/computador, salvar, visualizar | ✅ |
| Histórico de versões e restauração | ✅ |
| Envio de imagens próprias (upload de arquivos) | 🚧 requer armazenamento de objetos (S3/R2) |
| Mapa do Google dentro do site publicado + "Traçar rota" | ✅ rota sem chave; mapa embutido 🔑 `GOOGLE_MAPS_EMBED_KEY` |
| Acessibilidade dos sites (pular conteúdo, foco visível, ARIA nas abas e menu, contraste mínimo calculado) | ✅ testado |
| SEO dos sites (canonical, Open Graph, schema.org por tipo de negócio, favicon) | ✅ testado |
| Formulário com validação, mensagens de erro e estados de envio (erro com tremida, sucesso com check animado) | ✅ testado |
| Fotos reais do estabelecimento (Google) na capa, “sobre”, serviços/produtos e galeria, sem expor a chave | 🔑 `GOOGLE_MAPS_SERVER_KEY` (Places API New) |
| Galeria com lightbox (teclado, toque, foco preso, contador, legenda e crédito) | ✅ testado |
| Imagens AVIF/WebP com srcset, dimensões, carregamento sob demanda e capa prioritária | ✅ testado (AVIF/WebP no banco Unsplash; fotos do Google em JPEG nas larguras 480/960/1600) |
| Animações (entrada ao rolar com deslize/zoom/fade, hover em cards e imagens, ondulação em botões, menu, destaque no título) com movimento reduzido | ✅ |
| Barra de ações fixa no celular (Ligar, WhatsApp, Rota) | ✅ |

## Publicação e hospedagem
| Item | Status |
|---|---|
| Publicar, atualizar, despublicar com endereço `slug.ROOT_DOMAIN` | ✅ testado (requer DNS curinga em produção) |
| HTTPS automático (Caddy on-demand TLS + autorização via `/api/domains/check`) | 🧪 configuração pronta; validar no servidor |
| Domínios próprios (CNAME + verificação de DNS) | ✅ / 🧪 |
| Limite de sites simultâneos (transação com trava) | ✅ testado |
| Suspensão automática no vencimento, página de indisponibilidade, reativação no pagamento | ✅ testado |
| Retenção de 30 dias (configurável) e exclusão posterior | ✅ testado |
| Exportação .zip (HTML + JSON) | ✅ testado |
| Contador de visitas (sem cookies) | ✅ |
| Backup diário do banco | ✅ no docker-compose (cópia externa: configurar) |
| Transferência automatizada para outra hospedagem | 🚧 (hoje: exportação manual) |

## Assinatura (Kiwify)
| Item | Status |
|---|---|
| Botão “Assinar agora” → checkout real da Kiwify com referência da conta | 🔑 URL do checkout |
| Webhook com validação HMAC-SHA1 (vetor oficial da Kiwify nos testes) | ✅ testado |
| Idempotência, registro de eventos, reprocessamento por reenvio | ✅ testado |
| Aprovado, recusado, boleto/pix pendente, renovado, cancelado, atrasado, reembolso, chargeback | ✅ testado |
| Vínculo por `sck`, id da assinatura ou e-mail; vínculo manual pelo admin | ✅ testado / 🧪 confirmar campos com compra real |
| Valores bruto/taxa/líquido | 🧪 nomes dos campos não documentados; o painel avisa quando faltam |
| Conciliação pela API pública da Kiwify (`/v1/sales`) | 🚧 variáveis reservadas, não implementado |

## Vendas
| Item | Status |
|---|---|
| Proposta comercial (IA para textos; preços, prazos e condições do usuário), edição, versão final, copiar, PDF | ✅ testado |
| Mensagem de abordagem personalizada + abrir no WhatsApp (envio sempre manual) | ✅ testado |

## Painéis
| Item | Status |
|---|---|
| Painel do assinante: cards, gráfico de atividade, uso do plano com avisos de limite | ✅ |
| Meus sites: filtros por status e data, ações completas | ✅ |
| Admin: assinantes ativos, MRR, faturamento recebido (bruto/taxas/líquido), pendentes, cancelamentos, reembolsos, gráfico | ✅ |
| Admin: usuários, consumo, suspender/reativar, sites, pagamentos sem conta, configurações (preço, limites, carência, retenção) | ✅ |

## Observações
- **Preço:** a especificação cita R$ 77 e, em dois pontos, R$ 30. Foi adotado **R$ 77** (configurável em Admin → Configurações). O valor cobrado de fato é o do produto na Kiwify.
- **Várias contas para contornar limites:** os limites são por conta, e cada conta precisa da própria assinatura paga, então criar contas extras não dá uso gratuito. Os limites são verificados no backend de forma atômica. Não há *fingerprint* de dispositivo.
- **Taxas do Google Places e da Anthropic** são pagas pelo dono da plataforma. Os limites mensais existem para controlar esse custo.
