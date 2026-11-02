// Textos-modelo profissionais por segmento, usados quando a IA não está disponível
// (e como base de qualidade). Nada aqui afirma fatos específicos da empresa:
// preços, anos de experiência, avaliações e prêmios nunca aparecem.
// Marcadores: {nome}, {onde} (bairro/cidade), {cidade}.

type Item = { title: string; description: string; icon: string };
type MenuCat = { name: string; items: { name: string; description: string }[] };

export type SegmentCopy = {
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  marquee: string[];
  highlights: { icon: string; title: string; text: string }[];
  aboutTitle: string;
  aboutText: string;
  servicesTitle: string;
  servicesIntro: string;
  services: Item[];
  menu?: MenuCat[];
  steps: { title: string; text: string }[];
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaText: string;
  quoteTitle?: string;
  quoteText?: string;
};

const FAQ_CONTATO = { q: "Qual a forma mais rápida de falar com vocês?", a: "Pelo WhatsApp: é só tocar no botão verde desta página. Respondemos assim que possível." };
const FAQ_LOCAL = { q: "Como faço para chegar?", a: "Use o botão “Como chegar” nesta página: ele abre a rota no Google Maps a partir de onde você estiver." };

export const COPY: Record<string, SegmentCopy> = {
  barbearia: {
    tagline: "Barbearia · {cidade}",
    heroTitle: "Seu estilo, no detalhe",
    heroSubtitle: "Corte, barba e acabamento feitos com calma e capricho. Chegue, sente na cadeira e saia do jeito que você gosta.",
    primaryCta: "Agendar horário",
    marquee: ["Corte na tesoura", "Barba na navalha", "Degradê", "Acabamento", "Toalha quente", "Estilo clássico e moderno"],
    highlights: [
      { icon: "scissors", title: "Feito à mão", text: "Tesoura, máquina e navalha usadas com precisão para cada tipo de cabelo." },
      { icon: "calendar", title: "Hora marcada", text: "Agende pelo WhatsApp e seja atendido no seu horário, sem fila." },
      { icon: "sparkles", title: "Ambiente de respeito", text: "Um lugar para relaxar, conversar e cuidar do visual com tranquilidade." },
    ],
    aboutTitle: "Mais que um corte",
    aboutText: "A {nome} nasceu para ser aquele lugar onde você confia no barbeiro e sai sempre bem. Cada atendimento começa com uma conversa rápida para entender o que você quer.\n\nDo corte clássico ao degradê mais moderno, da barba desenhada ao acabamento na navalha: o cuidado está nos detalhes.",
    servicesTitle: "Serviços",
    servicesIntro: "Escolha o serviço e agende pelo WhatsApp.",
    services: [
      { title: "Corte masculino", description: "Na tesoura ou na máquina, do clássico ao moderno.", icon: "scissors" },
      { title: "Barba", description: "Desenho, aparo e acabamento na navalha com toalha quente.", icon: "razor" },
      { title: "Corte + barba", description: "O combo completo para sair renovado.", icon: "sparkles" },
      { title: "Degradê", description: "Transições suaves e bem marcadas, do jeito que você pedir.", icon: "star" },
      { title: "Sobrancelha", description: "Limpeza e alinhamento discretos.", icon: "check" },
      { title: "Pigmentação", description: "Para disfarçar falhas na barba ou no cabelo. Consulte disponibilidade.", icon: "bolt" },
    ],
    steps: [
      { title: "Chame no WhatsApp", text: "Diga o serviço e o melhor dia para você." },
      { title: "Confirme o horário", text: "Respondemos com os horários livres." },
      { title: "É só chegar", text: "Sente na cadeira e deixe com a gente." },
    ],
    faq: [
      { q: "Preciso agendar?", a: "Recomendamos agendar pelo WhatsApp para garantir seu horário. Se houver vaga, também atendemos por ordem de chegada." },
      { q: "Quanto tempo leva um corte?", a: "Depende do serviço escolhido. Ao agendar, informamos a duração prevista." },
      { q: "Quais formas de pagamento vocês aceitam?", a: "Confirme as formas de pagamento disponíveis pelo WhatsApp antes do atendimento." },
      FAQ_LOCAL,
    ],
    ctaTitle: "Bora dar um tapa no visual?",
    ctaText: "Escolha o horário pelo WhatsApp em menos de um minuto.",
  },
  salao: {
    tagline: "Salão de beleza · {cidade}",
    heroTitle: "Beleza que combina com você",
    heroSubtitle: "Cabelo, unhas e cuidados feitos com carinho e atenção. Um momento seu, do jeito que você merece.",
    primaryCta: "Agendar horário",
    marquee: ["Corte", "Escova", "Coloração", "Hidratação", "Manicure", "Pedicure", "Penteados"],
    highlights: [
      { icon: "sparkles", title: "Atendimento cuidadoso", text: "Ouvimos o que você quer antes de começar." },
      { icon: "heart", title: "Seu momento", text: "Um ambiente acolhedor para relaxar enquanto se cuida." },
      { icon: "calendar", title: "Agenda fácil", text: "Marque pelo WhatsApp e evite espera." },
    ],
    aboutTitle: "Um espaço para você",
    aboutText: "A {nome} é o lugar para cuidar do cabelo, das unhas e da autoestima com calma e atenção.\n\nCada atendimento é pensado a partir do seu estilo, da sua rotina e do resultado que você quer ver no espelho.",
    servicesTitle: "Serviços",
    servicesIntro: "Conheça os cuidados e agende o seu.",
    services: [
      { title: "Corte feminino", description: "Do repicado ao chanel, pensado para o seu rosto e rotina.", icon: "scissors" },
      { title: "Escova e finalização", description: "Lisa, modelada ou com ondas: pronta para o seu dia.", icon: "sparkles" },
      { title: "Coloração", description: "Tons, mechas e retoques. Consulte as técnicas disponíveis.", icon: "star" },
      { title: "Tratamentos capilares", description: "Hidratação, nutrição e reconstrução para fios mais saudáveis.", icon: "leaf" },
      { title: "Manicure e pedicure", description: "Unhas bem cuidadas, com capricho nos detalhes.", icon: "heart" },
      { title: "Penteados", description: "Para festas e ocasiões especiais.", icon: "award" },
    ],
    steps: [
      { title: "Escolha o serviço", text: "Conte o que você quer pelo WhatsApp." },
      { title: "Marque o horário", text: "Enviamos as opções disponíveis." },
      { title: "Relaxe", text: "Chegue e aproveite o seu momento." },
    ],
    faq: [
      { q: "Preciso agendar?", a: "Sim, recomendamos agendar pelo WhatsApp para garantir o horário ideal para você." },
      { q: "Vocês fazem avaliação antes da coloração?", a: "Fale com a gente pelo WhatsApp para combinar uma conversa antes do procedimento." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Reserve o seu momento",
    ctaText: "Agende pelo WhatsApp e chegue na hora certa.",
  },
  restaurante: {
    tagline: "Restaurante · {onde}",
    heroTitle: "Comida boa, mesa farta",
    heroSubtitle: "Pratos preparados com cuidado, ingredientes selecionados e um ambiente para reunir quem você gosta.",
    primaryCta: "Reservar mesa",
    marquee: ["Pratos da casa", "Almoço", "Jantar", "Sobremesas", "Ambiente acolhedor", "Para toda a família"],
    highlights: [
      { icon: "chef", title: "Feito na hora", text: "Receitas preparadas na nossa cozinha, do jeito certo." },
      { icon: "users", title: "Para reunir", text: "Mesas para o almoço do dia a dia e para celebrar com a família." },
      { icon: "truck", title: "Pedidos", text: "Fale com a gente para saber como pedir para viagem ou entrega." },
    ],
    aboutTitle: "Sabor que vira tradição",
    aboutText: "A {nome} recebe cada cliente como alguém de casa. Na cozinha, o cuidado começa na escolha dos ingredientes e termina no prato bem servido.\n\nVenha almoçar, jantar ou comemorar: sempre tem lugar à mesa.",
    servicesTitle: "Experiências",
    servicesIntro: "Do almoço rápido ao jantar especial.",
    services: [
      { title: "Almoço", description: "Pratos para o dia a dia, servidos com capricho.", icon: "utensils" },
      { title: "Jantar", description: "Um ambiente agradável para terminar o dia.", icon: "wine" },
      { title: "Encomendas", description: "Consulte opções para eventos e datas especiais.", icon: "calendar" },
    ],
    menu: [
      { name: "Entradas", items: [
        { name: "Bruschetta da casa", description: "Pão tostado, tomate fresco, manjericão e azeite." },
        { name: "Bolinhos crocantes", description: "Porção dourada, ideal para dividir." },
        { name: "Salada da estação", description: "Folhas frescas, legumes e molho da casa." },
      ] },
      { name: "Pratos principais", items: [
        { name: "Filé grelhado", description: "Acompanha arroz, legumes salteados e molho." },
        { name: "Massa ao molho de tomate", description: "Molho cozido lentamente, finalizado com parmesão." },
        { name: "Frango ao forno", description: "Temperado com ervas, servido com batatas." },
        { name: "Peixe do dia", description: "Consulte a preparação do dia." },
        { name: "Opção vegetariana", description: "Pergunte qual é a sugestão do chef." },
      ] },
      { name: "Sobremesas", items: [
        { name: "Pudim", description: "Cremoso, com calda de caramelo." },
        { name: "Mousse de chocolate", description: "Leve e intensa." },
        { name: "Sobremesa do dia", description: "Consulte a opção disponível." },
      ] },
      { name: "Bebidas", items: [
        { name: "Sucos naturais", description: "Feitos na hora com frutas da estação." },
        { name: "Refrigerantes e águas", description: "Opções geladas." },
        { name: "Carta de vinhos", description: "Consulte os rótulos disponíveis." },
      ] },
    ],
    steps: [
      { title: "Chame no WhatsApp", text: "Informe o dia, o horário e quantas pessoas." },
      { title: "Confirmamos", text: "Respondemos com a confirmação da reserva." },
      { title: "Bom apetite", text: "É só chegar e aproveitar." },
    ],
    faq: [
      { q: "Vocês aceitam reservas?", a: "Fale com a gente pelo WhatsApp para verificar a disponibilidade de mesas." },
      { q: "Tem opções vegetarianas?", a: "Pergunte pelo WhatsApp quais são as opções do dia." },
      { q: "Fazem entrega ou retirada?", a: "Consulte pelo WhatsApp as formas de pedido disponíveis." },
      FAQ_LOCAL,
    ],
    ctaTitle: "Bateu a fome?",
    ctaText: "Reserve sua mesa ou faça seu pedido pelo WhatsApp.",
  },
  odontologia: {
    tagline: "Clínica odontológica · {cidade}",
    heroTitle: "Seu sorriso em boas mãos",
    heroSubtitle: "Atendimento odontológico com cuidado, explicação clara de cada etapa e respeito ao seu tempo.",
    primaryCta: "Agendar avaliação",
    marquee: ["Avaliação", "Limpeza", "Clareamento", "Restaurações", "Ortodontia", "Implantes", "Odontopediatria"],
    highlights: [
      { icon: "shield", title: "Segurança", text: "Protocolos de higiene e esterilização em cada atendimento." },
      { icon: "chat", title: "Explicação clara", text: "Você entende o tratamento e as opções antes de começar." },
      { icon: "calendar", title: "Agenda organizada", text: "Horários marcados para você não perder tempo." },
    ],
    aboutTitle: "Cuidado do primeiro contato ao último retorno",
    aboutText: "Na {nome}, cada paciente é atendido com calma e atenção. A consulta começa ouvindo você e termina com um plano de tratamento explicado passo a passo.\n\nNosso objetivo é que você se sinta seguro e confortável em todas as etapas.",
    servicesTitle: "Especialidades",
    servicesIntro: "Consulte quais tratamentos estão disponíveis para o seu caso.",
    services: [
      { title: "Avaliação e prevenção", description: "Check-up completo e orientações para manter a saúde bucal.", icon: "tooth" },
      { title: "Limpeza", description: "Remoção de placa e tártaro para dentes e gengivas saudáveis.", icon: "sparkles" },
      { title: "Clareamento", description: "Sorriso mais claro com acompanhamento profissional.", icon: "star" },
      { title: "Restaurações", description: "Recuperação de dentes com material da cor natural.", icon: "check" },
      { title: "Ortodontia", description: "Aparelhos para alinhar os dentes. Consulte as opções.", icon: "smile" },
      { title: "Implantes e próteses", description: "Reabilitação do sorriso. Avaliação necessária.", icon: "shield" },
    ],
    steps: [
      { title: "Agende a avaliação", text: "Escolha o melhor horário pelo WhatsApp." },
      { title: "Consulta", text: "Examinamos e explicamos as opções para o seu caso." },
      { title: "Plano de tratamento", text: "Você decide com tranquilidade e todas as informações." },
    ],
    faq: [
      { q: "Vocês atendem convênio?", a: "Consulte pelo WhatsApp quais convênios e formas de pagamento são aceitos." },
      { q: "Atendem crianças?", a: "Fale com a gente para verificar o atendimento infantil disponível." },
      { q: "E em caso de urgência?", a: "Entre em contato pelo WhatsApp ou telefone para verificarmos o primeiro horário disponível." },
      FAQ_LOCAL,
    ],
    ctaTitle: "Agende sua avaliação",
    ctaText: "Converse com a nossa equipe e encontre o melhor horário para você.",
  },
  clinica: {
    tagline: "Clínica · {cidade}",
    heroTitle: "Saúde com atenção de verdade",
    heroSubtitle: "Atendimento humano, horários organizados e profissionais dedicados a cuidar de você.",
    primaryCta: "Agendar consulta",
    marquee: ["Consultas", "Exames", "Retornos", "Acompanhamento", "Atendimento humanizado"],
    highlights: [
      { icon: "heart", title: "Atendimento humano", text: "Tempo para ouvir, examinar e explicar." },
      { icon: "calendar", title: "Agendamento simples", text: "Marque pelo WhatsApp ou por telefone." },
      { icon: "shield", title: "Cuidado contínuo", text: "Acompanhamento em cada etapa do tratamento." },
    ],
    aboutTitle: "Cuidado que começa no acolhimento",
    aboutText: "A {nome} foi pensada para oferecer um atendimento atencioso, do agendamento ao retorno.\n\nAqui, cada paciente tem espaço para tirar dúvidas e entender cada passo do cuidado com a saúde.",
    servicesTitle: "Especialidades",
    servicesIntro: "Consulte as especialidades e os horários disponíveis.",
    services: [
      { title: "Consultas", description: "Atendimento com profissionais da área.", icon: "stethoscope" },
      { title: "Check-up", description: "Avaliação geral para cuidar da saúde com antecedência.", icon: "heart" },
      { title: "Exames", description: "Consulte os exames realizados na clínica.", icon: "check" },
      { title: "Retornos", description: "Acompanhamento da evolução do seu tratamento.", icon: "calendar" },
    ],
    steps: [
      { title: "Agende", text: "Escolha o horário pelo WhatsApp." },
      { title: "Seja atendido", text: "Chegue alguns minutos antes com seus documentos." },
      { title: "Acompanhamento", text: "Marcamos o retorno quando necessário." },
    ],
    faq: [
      { q: "Vocês atendem convênio?", a: "Consulte pelo WhatsApp quais convênios são aceitos." },
      { q: "O que devo levar na consulta?", a: "Documento com foto e, se tiver, exames anteriores." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Cuide da sua saúde hoje",
    ctaText: "Agende sua consulta pelo WhatsApp.",
  },
  academia: {
    tagline: "Academia · {cidade}",
    heroTitle: "Treine forte. Evolua sempre.",
    heroSubtitle: "Estrutura para o seu treino, acompanhamento e um ambiente que motiva você a voltar todos os dias.",
    primaryCta: "Agendar visita",
    marquee: ["Musculação", "Funcional", "Cardio", "Aulas coletivas", "Avaliação", "Treino orientado"],
    highlights: [
      { icon: "dumbbell", title: "Estrutura completa", text: "Equipamentos para treinar todos os grupos musculares." },
      { icon: "users", title: "Orientação", text: "Profissionais para ajudar você a treinar com segurança." },
      { icon: "bolt", title: "Energia", text: "Um ambiente que dá vontade de treinar." },
    ],
    aboutTitle: "Seu objetivo é o nosso treino",
    aboutText: "Na {nome}, cada aluno tem um objetivo diferente: ganhar força, emagrecer, ter mais disposição. Nosso trabalho é ajudar você a chegar lá.\n\nVenha conhecer a estrutura e fazer uma visita.",
    servicesTitle: "Modalidades",
    servicesIntro: "Consulte horários e planos disponíveis.",
    services: [
      { title: "Musculação", description: "Treino de força com acompanhamento.", icon: "dumbbell" },
      { title: "Funcional", description: "Exercícios dinâmicos para o corpo todo.", icon: "bolt" },
      { title: "Cardio", description: "Esteiras, bikes e mais para o condicionamento.", icon: "heart" },
      { title: "Aulas coletivas", description: "Treinos em grupo com muita energia. Consulte a grade.", icon: "users" },
      { title: "Avaliação física", description: "Para acompanhar sua evolução.", icon: "check" },
    ],
    steps: [
      { title: "Agende uma visita", text: "Conheça a academia pessoalmente." },
      { title: "Escolha o plano", text: "Tiramos suas dúvidas sobre horários e modalidades." },
      { title: "Comece a treinar", text: "Montamos o seu treino." },
    ],
    faq: [
      { q: "Posso fazer uma aula experimental?", a: "Fale com a gente pelo WhatsApp para verificar a disponibilidade." },
      { q: "Quais são os planos?", a: "Consulte planos e valores atualizados pelo WhatsApp." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Seu primeiro treino começa aqui",
    ctaText: "Agende uma visita pelo WhatsApp.",
  },
  oficina: {
    tagline: "Oficina mecânica · {cidade}",
    heroTitle: "Seu carro em boas mãos",
    heroSubtitle: "Diagnóstico honesto, orçamento antes do serviço e cuidado com cada detalhe do seu veículo.",
    primaryCta: "Pedir orçamento",
    marquee: ["Revisão", "Freios", "Suspensão", "Troca de óleo", "Injeção eletrônica", "Diagnóstico", "Ar-condicionado"],
    highlights: [
      { icon: "gauge", title: "Diagnóstico claro", text: "Explicamos o problema antes de mexer no carro." },
      { icon: "chat", title: "Orçamento antes", text: "Você aprova o serviço sabendo o que será feito." },
      { icon: "shield", title: "Segurança", text: "Freios, suspensão e itens essenciais revisados com atenção." },
    ],
    aboutTitle: "Confiança em cada serviço",
    aboutText: "Na {nome}, o seu carro é tratado com o mesmo cuidado que daríamos ao nosso. Antes de qualquer serviço, você recebe a explicação do problema e o orçamento.\n\nNosso compromisso é resolver de verdade, sem surpresas.",
    servicesTitle: "Serviços",
    servicesIntro: "Peça um orçamento sem compromisso.",
    services: [
      { title: "Revisão preventiva", description: "Checagem completa para rodar com tranquilidade.", icon: "gauge" },
      { title: "Freios", description: "Pastilhas, discos e fluido revisados.", icon: "shield" },
      { title: "Suspensão", description: "Amortecedores, molas e alinhamento do conjunto.", icon: "car" },
      { title: "Troca de óleo e filtros", description: "Com o produto indicado para o seu veículo.", icon: "wrench" },
      { title: "Injeção eletrônica", description: "Diagnóstico com scanner e correção de falhas.", icon: "bolt" },
      { title: "Ar-condicionado", description: "Higienização e verificação do sistema.", icon: "leaf" },
    ],
    steps: [
      { title: "Conte o problema", text: "Descreva o sintoma pelo WhatsApp ou formulário." },
      { title: "Diagnóstico e orçamento", text: "Avaliamos o carro e passamos o valor." },
      { title: "Serviço aprovado", text: "Só fazemos o que você autorizar." },
    ],
    faq: [
      { q: "Vocês fazem orçamento antes do serviço?", a: "Sim. Nenhum serviço é feito sem a sua aprovação." },
      { q: "Quanto tempo o carro fica na oficina?", a: "Depende do serviço. Informamos o prazo junto com o orçamento." },
      { q: "Atendem todas as marcas?", a: "Consulte pelo WhatsApp informando marca e modelo do veículo." },
      FAQ_LOCAL,
    ],
    ctaTitle: "Barulho estranho no carro?",
    ctaText: "Fale com a gente e peça seu orçamento.",
    quoteTitle: "Peça seu orçamento",
    quoteText: "Informe marca, modelo e o que está acontecendo. Respondemos pelo WhatsApp.",
  },
  roupas: {
    tagline: "Moda · {cidade}",
    heroTitle: "Peças para ser você",
    heroSubtitle: "Moda escolhida a dedo, atendimento próximo e novidades que combinam com o seu estilo.",
    primaryCta: "Ver novidades",
    marquee: ["Novidades", "Feminino", "Masculino", "Acessórios", "Tendências", "Peças selecionadas"],
    highlights: [
      { icon: "sparkles", title: "Curadoria", text: "Peças escolhidas para combinar entre si e com você." },
      { icon: "smile", title: "Atendimento próximo", text: "Ajudamos você a montar o look." },
      { icon: "bag", title: "Reserve pelo WhatsApp", text: "Viu algo? Reserve antes de vir à loja." },
    ],
    aboutTitle: "Estilo com personalidade",
    aboutText: "A {nome} é para quem gosta de se vestir bem sem complicação. Selecionamos peças versáteis, confortáveis e com personalidade.\n\nVenha conhecer a loja ou chame no WhatsApp para ver as novidades.",
    servicesTitle: "Destaques",
    servicesIntro: "Algumas das categorias que você encontra na loja.",
    services: [
      { title: "Novidades da semana", description: "Peças que acabaram de chegar.", icon: "sparkles" },
      { title: "Básicos versáteis", description: "Para montar vários looks com poucas peças.", icon: "shirt" },
      { title: "Ocasiões especiais", description: "Para festas, eventos e encontros.", icon: "star" },
      { title: "Acessórios", description: "Os detalhes que completam o visual.", icon: "tag" },
    ],
    steps: [
      { title: "Veja as novidades", text: "Peça fotos das peças pelo WhatsApp." },
      { title: "Reserve", text: "Separamos o tamanho para você." },
      { title: "Retire ou receba", text: "Combine a forma de retirada ou envio." },
    ],
    faq: [
      { q: "Posso reservar uma peça?", a: "Sim, fale com a gente pelo WhatsApp para verificar a disponibilidade." },
      { q: "Vocês fazem troca?", a: "Consulte a política de trocas pelo WhatsApp." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Chegou coisa nova",
    ctaText: "Peça fotos das novidades pelo WhatsApp.",
  },
  imobiliaria: {
    tagline: "Imobiliária · {cidade}",
    heroTitle: "O imóvel certo para sua nova fase",
    heroSubtitle: "Compra, venda e locação com atendimento próximo, transparência e orientação em cada etapa.",
    primaryCta: "Falar com corretor",
    marquee: ["Compra", "Venda", "Locação", "Avaliação", "Documentação", "Atendimento personalizado"],
    highlights: [
      { icon: "home", title: "Imóveis selecionados", text: "Opções alinhadas ao seu perfil e orçamento." },
      { icon: "key", title: "Do contato à chave", text: "Acompanhamos visita, proposta e documentação." },
      { icon: "chat", title: "Transparência", text: "Informações claras para você decidir com segurança." },
    ],
    aboutTitle: "Atendimento que entende você",
    aboutText: "A {nome} ajuda pessoas a encontrar o lugar certo para morar, investir ou empreender.\n\nNosso trabalho começa entendendo o que você precisa e segue até a entrega das chaves.",
    servicesTitle: "Serviços",
    servicesIntro: "Conte o que você procura e ajudamos a encontrar.",
    services: [
      { title: "Compra", description: "Encontramos opções de acordo com o seu perfil.", icon: "home" },
      { title: "Venda", description: "Divulgação e acompanhamento da negociação.", icon: "tag" },
      { title: "Locação", description: "Imóveis para alugar com processo simples.", icon: "key" },
      { title: "Avaliação", description: "Ajuda para definir o valor do seu imóvel.", icon: "ruler" },
    ],
    steps: [
      { title: "Conte o que procura", text: "Bairro, tamanho e orçamento." },
      { title: "Visite as opções", text: "Agendamos as visitas no seu horário." },
      { title: "Feche com segurança", text: "Acompanhamos proposta e documentação." },
    ],
    faq: [
      { q: "Vocês ajudam com financiamento?", a: "Fale com a gente para entender as opções para o seu caso." },
      { q: "Como anuncio meu imóvel?", a: "Entre em contato pelo WhatsApp para agendarmos uma avaliação." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Vamos encontrar seu imóvel?",
    ctaText: "Conte o que você procura pelo WhatsApp.",
    quoteTitle: "Conte o que você procura",
    quoteText: "Bairro, tipo de imóvel e faixa de valor. Retornamos com opções.",
  },
  servicos: {
    tagline: "Serviços profissionais · {cidade}",
    heroTitle: "Soluções sob medida para você",
    heroSubtitle: "Atendimento próximo, orçamento claro e compromisso com o resultado do começo ao fim.",
    primaryCta: "Pedir orçamento",
    marquee: ["Atendimento personalizado", "Orçamento sem compromisso", "Pontualidade", "Qualidade", "Transparência"],
    highlights: [
      { icon: "users", title: "Atendimento direto", text: "Você fala com quem faz o serviço." },
      { icon: "chat", title: "Orçamento claro", text: "Tudo explicado antes de começar." },
      { icon: "check", title: "Compromisso", text: "Prazos combinados e acompanhamento." },
    ],
    aboutTitle: "Trabalho bem feito, do jeito combinado",
    aboutText: "A {nome} atende cada cliente entendendo a necessidade antes de propor qualquer solução.\n\nNosso foco é entregar o que foi combinado, com transparência e atenção aos detalhes.",
    servicesTitle: "Serviços",
    servicesIntro: "Conte o que você precisa e preparamos um orçamento.",
    services: [
      { title: "Consultoria inicial", description: "Entendemos a sua necessidade.", icon: "chat" },
      { title: "Execução", description: "Serviço realizado com cuidado e no prazo.", icon: "briefcase" },
      { title: "Acompanhamento", description: "Suporte depois da entrega.", icon: "check" },
    ],
    steps: [
      { title: "Conte o que precisa", text: "Pelo WhatsApp ou formulário." },
      { title: "Receba o orçamento", text: "Explicamos cada item." },
      { title: "Agende o serviço", text: "Combinamos data e detalhes." },
    ],
    faq: [
      { q: "O orçamento tem custo?", a: "Fale com a gente pelo WhatsApp para entender como funciona o orçamento para o seu caso." },
      { q: "Qual o prazo de atendimento?", a: "Informamos o prazo junto com o orçamento." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Vamos resolver isso?",
    ctaText: "Peça seu orçamento pelo WhatsApp.",
    quoteTitle: "Solicite um orçamento",
    quoteText: "Descreva o que você precisa. Retornamos pelo WhatsApp.",
  },
  petshop: {
    tagline: "Pet shop · {cidade}",
    heroTitle: "Carinho para quem é da família",
    heroSubtitle: "Banho, tosa e produtos para o seu pet, com atendimento cuidadoso e muito amor pelos animais.",
    primaryCta: "Agendar banho",
    marquee: ["Banho", "Tosa", "Rações", "Petiscos", "Acessórios", "Brinquedos", "Higiene"],
    highlights: [
      { icon: "paw", title: "Amor pelos pets", text: "Cada animal tratado com paciência e carinho." },
      { icon: "sparkles", title: "Banho e tosa", text: "Seu pet limpinho e cheiroso." },
      { icon: "bag", title: "Tudo para o seu pet", text: "Rações, petiscos e acessórios." },
    ],
    aboutTitle: "Feito por quem ama animais",
    aboutText: "A {nome} cuida do seu pet como se fosse da nossa família.\n\nDo banho caprichado aos produtos do dia a dia, estamos aqui para facilitar a vida de quem tem bichinho em casa.",
    servicesTitle: "Serviços e produtos",
    servicesIntro: "Agende pelo WhatsApp ou consulte disponibilidade.",
    services: [
      { title: "Banho", description: "Com produtos adequados ao tipo de pelo.", icon: "sparkles" },
      { title: "Tosa", description: "Higiênica ou completa, do jeito certo para a raça.", icon: "scissors" },
      { title: "Rações e petiscos", description: "Opções para cães e gatos.", icon: "bag" },
      { title: "Acessórios", description: "Coleiras, caminhas, brinquedos e mais.", icon: "paw" },
    ],
    steps: [
      { title: "Agende pelo WhatsApp", text: "Informe porte e serviço." },
      { title: "Traga seu pet", text: "Recebemos com carinho." },
      { title: "Busque cheiroso", text: "Avisamos quando estiver pronto." },
    ],
    faq: [
      { q: "Preciso agendar o banho?", a: "Sim, agende pelo WhatsApp para garantir o horário." },
      { q: "Vocês buscam o pet em casa?", a: "Consulte pelo WhatsApp se há serviço de leva e traz." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Seu pet merece esse cuidado",
    ctaText: "Agende o banho pelo WhatsApp.",
  },
  padaria: {
    tagline: "Padaria · {onde}",
    heroTitle: "Pão quentinho todo dia",
    heroSubtitle: "Fornadas fresquinhas, doces e salgados para o café da manhã, o lanche da tarde e as ocasiões especiais.",
    primaryCta: "Fazer encomenda",
    marquee: ["Pão francês", "Pães especiais", "Bolos", "Doces", "Salgados", "Café", "Encomendas"],
    highlights: [
      { icon: "bread", title: "Fornadas frescas", text: "Pães saindo do forno ao longo do dia." },
      { icon: "coffee", title: "Café e lanche", text: "Para começar o dia ou fazer uma pausa." },
      { icon: "calendar", title: "Encomendas", text: "Bolos e salgados para festas e reuniões." },
    ],
    aboutTitle: "O cheirinho de pão que você conhece",
    aboutText: "A {nome} faz parte da rotina do bairro: do pãozinho da manhã ao bolo de aniversário.\n\nVenha tomar um café, levar pão quentinho ou encomendar para a sua festa.",
    servicesTitle: "Para você",
    servicesIntro: "Pergunte pelo WhatsApp o que está saindo do forno.",
    services: [
      { title: "Pães", description: "Francês, de forma e especiais.", icon: "bread" },
      { title: "Confeitaria", description: "Bolos, tortas e doces.", icon: "heart" },
      { title: "Salgados", description: "Para o lanche e para festas.", icon: "star" },
      { title: "Café", description: "Para acompanhar.", icon: "coffee" },
    ],
    menu: [
      { name: "Pães", items: [
        { name: "Pão francês", description: "Crocante por fora, macio por dentro." },
        { name: "Pão de forma", description: "Ideal para sanduíches." },
        { name: "Pães especiais", description: "Consulte as opções do dia." },
      ] },
      { name: "Doces e bolos", items: [
        { name: "Bolo caseiro", description: "Fatias e bolos inteiros." },
        { name: "Sonho", description: "Recheado e polvilhado com açúcar." },
        { name: "Tortas", description: "Consulte os sabores disponíveis." },
      ] },
      { name: "Salgados", items: [
        { name: "Coxinha", description: "Massa macia e recheio generoso." },
        { name: "Pão de queijo", description: "Quentinho, saindo do forno." },
        { name: "Esfiha", description: "Consulte os sabores." },
      ] },
      { name: "Bebidas", items: [
        { name: "Café coado", description: "Fresquinho." },
        { name: "Café com leite", description: "Para acompanhar o pão na chapa." },
        { name: "Sucos", description: "Consulte os sabores." },
      ] },
    ],
    steps: [
      { title: "Chame no WhatsApp", text: "Diga o que você quer encomendar." },
      { title: "Combine data e horário", text: "Confirmamos a disponibilidade." },
      { title: "Retire fresquinho", text: "Pronto na hora combinada." },
    ],
    faq: [
      { q: "Vocês aceitam encomendas?", a: "Sim. Fale com a gente pelo WhatsApp com antecedência." },
      { q: "Que horas sai o pão?", a: "Pergunte pelo WhatsApp os horários das fornadas." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Vai uma encomenda?",
    ctaText: "Bolos, doces e salgados: peça pelo WhatsApp.",
  },
  construcao: {
    tagline: "Construção e reformas · {cidade}",
    heroTitle: "Sua obra feita do jeito certo",
    heroSubtitle: "Construção e reformas com planejamento, orçamento detalhado e acompanhamento de cada etapa.",
    primaryCta: "Pedir orçamento",
    marquee: ["Construção", "Reformas", "Acabamento", "Projetos", "Planejamento", "Acompanhamento de obra"],
    highlights: [
      { icon: "ruler", title: "Planejamento", text: "Cada etapa da obra pensada antes de começar." },
      { icon: "chat", title: "Orçamento detalhado", text: "Você sabe exatamente o que está contratando." },
      { icon: "hammer", title: "Execução cuidadosa", text: "Atenção ao acabamento e à limpeza da obra." },
    ],
    aboutTitle: "Do projeto à entrega",
    aboutText: "A {nome} acompanha a sua obra com planejamento, comunicação clara e cuidado com os detalhes.\n\nSeja uma reforma pontual ou uma construção completa, você sabe o que está acontecendo em cada etapa.",
    servicesTitle: "Serviços",
    servicesIntro: "Conte sobre a sua obra e preparamos um orçamento.",
    services: [
      { title: "Construção", description: "Obras residenciais e comerciais.", icon: "home" },
      { title: "Reformas", description: "Cozinhas, banheiros, fachadas e mais.", icon: "hammer" },
      { title: "Acabamento", description: "Pisos, revestimentos e pintura.", icon: "ruler" },
      { title: "Projetos", description: "Planejamento antes de começar.", icon: "briefcase" },
    ],
    steps: [
      { title: "Conte sobre a obra", text: "Envie fotos e medidas pelo WhatsApp." },
      { title: "Visita e orçamento", text: "Avaliamos o local e detalhamos os custos." },
      { title: "Obra acompanhada", text: "Você recebe atualizações em cada etapa." },
    ],
    faq: [
      { q: "Vocês fazem visita técnica?", a: "Fale com a gente pelo WhatsApp para agendar." },
      { q: "Qual o prazo da obra?", a: "O prazo é definido no orçamento, de acordo com o escopo." },
      FAQ_CONTATO,
      FAQ_LOCAL,
    ],
    ctaTitle: "Vamos tirar sua obra do papel?",
    ctaText: "Peça seu orçamento pelo WhatsApp.",
    quoteTitle: "Peça seu orçamento",
    quoteText: "Descreva a obra, o local e se possível envie fotos pelo WhatsApp.",
  },
};

export function fill(text: string, vars: { nome: string; onde: string; cidade: string }) {
  return text
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{onde\}/g, vars.onde || vars.cidade || "sua região")
    .replace(/\{cidade\}/g, vars.cidade || vars.onde || "sua região")
    .replace(/ · sua região$/, "");
}
