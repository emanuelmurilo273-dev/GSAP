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
| Salvar empresas, anotações, atualizar dados pela fonte | ✅ / 🔑 |
| Nenhum dado inventado (sem chave → mensagem clara, a pesquisa não é contada) | ✅ testado |

## Estúdio de leads
| Item | Status |
|---|---|
| Critérios nicho / região / idioma / quantidade; histórico de buscas | ✅ |
| Descoberta real via Google Places (paginada até 30) | 🔑 `GOOGLE_PLACES_API_KEY` (testado com respostas simuladas) |
| Importação de CSV do usuário | ✅ testado |
| Modo demonstração (dados fictícios, sempre identificados, nunca deduplicados contra reais) | ✅ testado |
| Normalização e deduplicação (domínio, telefone, nome+cidade, perfil social) | ✅ testado |
| Verificação de presença: robots.txt (RFC 9309), só página inicial, proteção SSRF, limites de tempo e tamanho | ✅ testado (unidade); acesso real depende da rede do servidor |
| Proveniência por campo (confirmado / inferido / não encontrado / revisado) e oportunidades com evidência | ✅ testado |
| Perfil do lead: revisar, corrigir, excluir, restaurar, reanalisar, anotar | ✅ |
| Prévia do site só com fatos confirmados/revisados, faixa “prévia não publicada” | ✅ testado |
| Abordagem: assunto e mensagem em pt-BR + en/es, editar, copiar, exportar .txt/.md, descartar; nunca enviada | ✅ testado (texto com IA 🔑 `ANTHROPIC_API_KEY`) |
| Origem, licença e texto alternativo por imagem; aviso em imagens geradas; imagens da empresa só com autorização | ✅ |
| Google Flow | 🚧 sem API pública: fluxo **assistido** (prompt + importação manual + checagem). Nenhuma geração automática |
| Busca na web / diretórios além do Google Places | 🚧 interface `BusinessSearchProvider` pronta; nenhum provedor adicional implementado |
| Pipeline assíncrono (fila) para buscas grandes | 🚧 hoje é síncrono e limitado a 30 leads por busca |

## Sites
| Item | Status |
|---|---|
| “Criar site com IA” com 6 modelos (restaurante, barbearia/salão, clínica, oficina, loja, serviços) e 13 segmentos | ✅ (IA real 🔑 `ANTHROPIC_API_KEY`; sem chave usa textos-modelo sinalizados) |
| Proibição de depoimentos, avaliações, preços e horários inventados (prompt + modelo deixa preços e horários em branco) | ✅ |
| Imagens de banco autorizado com crédito | 🔑 `UNSPLASH_ACCESS_KEY` (ou URL própria) |
| Editor: textos, imagens, cores, fontes, seções (adicionar, remover, ocultar, reordenar), botões, links, prévia celular/computador, salvar, visualizar | ✅ |
| Histórico de versões e restauração | ✅ |
| Envio de imagens próprias (upload de arquivos) | 🚧 requer armazenamento de objetos (S3/R2) |

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
