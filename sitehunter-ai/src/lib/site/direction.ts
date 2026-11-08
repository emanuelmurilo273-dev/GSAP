import { nicheFromText, type NicheKey } from "./nicheProfile";

// Direção visual por ramo. Cada direção responde: quem decide aqui, o que essa pessoa precisa ver primeiro,
// e que linguagem (cor, tipografia, composição, movimento) sustenta isso. As referências são páginas de
// inspiração consultadas em novembro de 2026 (busca na web): servem de contexto, não são copiadas, e vários
// links são de agências ou vendedores de template, então tratam-se como opinião, não como dado.
// Ramos sem referências listadas ainda não tiveram pesquisa própria e usam uma direção conservadora.

export type Ref = { title: string; url: string; takeaway: string };
/** Estrutura da página: cada uma muda abertura, lista de serviços, galeria e tipografia (ver archetypes.ts). */
export type Archetype = "arc" | "showroom" | "display" | "poster" | "plate" | "spec" | "calm";
export type Step = { t: string; d: string };

export type DesignDirection = {
  key: NicheKey | "servicos";
  archetype: Archetype;
  /** Qual referência (descrição pública) inspirou a estrutura, em uma frase. */
  structure: string;
  /** Passos de "como pedir" (só ramos de orçamento): descrevem o que o visitante faz, nunca afirmam prática da empresa. */
  steps?: Step[];
  name: string;
  audience: string;
  /** noir = fundo escuro; ivory = fundo claro. */
  mood: "noir" | "ivory";
  /** Tons de paleta permitidos (as paletas variam por empresa dentro deles). */
  tones: ("warm" | "cool" | "bold" | "soft" | "earth")[];
  /** Fontes de título preferidas (nomes do repertório do conceito). */
  fonts: string[];
  layouts: ("left" | "right" | "center" | "editorial")[];
  composition: string;
  motion: string;
  /** Por que essa direção combina com o negócio. */
  why: string;
  refs: Ref[];
};

const R = {
  dealerFeatures: { title: "Essential Features for Automotive Websites (2026 Edition)", url: "https://spidersnet.co.uk/blog/essential-features-for-automotive-websites/", takeaway: "estoque com filtro e busca, rapidez no celular e confiança perto de cada ação" },
  dealerTips: { title: "10 Web Design Tips for Automotive Companies in 2026", url: "https://azurodigital.com/automotive-web-design-tips/", takeaway: "mobile primeiro e imagens leves, sem carrossel pesado" },
  repairTop: { title: "Top 25 auto repair websites of 2026 (and the design choices behind each one)", url: "https://freshysites.com/blog/top-auto-repair-websites/", takeaway: "o visitante quer saber o que você conserta, quanto custa e como marcar" },
  repairGuide: { title: "How to build an auto repair website: the complete guide", url: "https://tours.tekmetric.com/answers/how-to-build-an-auto-repair-website-the-complete-guide", takeaway: "foto autêntica da oficina comunica mais competência que banco de imagens" },
  repairEstimate: { title: "B12: auto repair website (pedido de orçamento com marca, modelo e ano)", url: "https://www.b12.io/prompt-gallery/auto-repair-website/", takeaway: "formulário curto que já pergunta marca, modelo, ano e o problema" },
  fitment: { title: "Automotive eCommerce Website Design for Aftermarket Parts", url: "https://webshopmanager.com/automotive-web-design/", takeaway: "navegação por ano, marca e modelo do veículo" },
  tire: { title: "Tire shop website design examples", url: "https://thestacc.com/blog/tire-shop-website-design-examples/", takeaway: "do pneu ao local e ao agendamento sem perder o contexto do veículo" },
  detail: { title: "Zarla: car detailing website inspiration", url: "https://www.zarla.com/inspiration/car-detailing", takeaway: "fundo escuro, títulos fortes e galerias de antes e depois" },
  detailGallery: { title: "Stunning Car Detailing Website Designs to Inspire You", url: "https://muffingroup.com/blog/car-detailing-website-design/", takeaway: "organizar fotos por tipo de serviço" },
  barber: { title: "Sleek Barbershop Website Design Examples", url: "https://www.sliderrevolution.com/design/barbershop-websites/", takeaway: "escuro com dourado como acento e agendamento no topo" },
  barber2: { title: "Barbershop Websites: 20 Design Examples (2026)", url: "https://nanoglobals.com/barbershop-websites/", takeaway: "ambiente e barbeiros em destaque, reserva sem sair do site" },
  pizza: { title: "Best pizza & pizzeria websites (Bento)", url: "https://getbento.com/blog/best-pizza-pizzeria-websites", takeaway: "paleta quente, fotografia grande da comida e navegação simples" },
  pizza2: { title: "Back Garden Pizzeria (DesignRush)", url: "https://www.designrush.com/best-designs/websites/back-garden-pizzeria-website-design", takeaway: "cores quentes, tipografia marcante e movimento suave" },
  restaurant: { title: "25 Beautiful Restaurant Website Designs", url: "https://www.crazyegg.com/blog/?p=2909", takeaway: "foto de prato, cardápio claro e caminho fácil para pedir ou reservar" },
  dental: { title: "10 Best Dental Website Designs of 2026", url: "https://azurodigital.com/dental-website-examples/", takeaway: "layout simples, cores calmas e fotos reais da equipe" },
  dental2: { title: "Modern dental website design 2026 (DentalBase)", url: "https://www.dentalbase.ai/blogs/modern-dental-website-design-2026", takeaway: "velocidade, uso no celular e caminho de agendamento claro acima de efeitos" },
  gym: { title: "10 Best Gym Website Design Ideas to Stand Out in 2026", url: "https://wod.guru/blog/gym-website-design/", takeaway: "contraste alto, título enorme e chamada clara para a aula experimental" },
  gym2: { title: "Best fitness website examples (HTMLBurger)", url: "https://htmlburger.com/blog/best-fitness-website-examples/", takeaway: "tipografia condensada e layout assimétrico" },
} satisfies Record<string, Ref>;

const D: Record<string, DesignDirection> = {
  concessionaria: {
    key: "concessionaria", archetype: "showroom", structure: 'Foto em tela cheia com título enorme na base e faixa de dados, serviços em linhas editoriais e galeria em faixa horizontal. Inspirada em Apex Roadster (tipografia editorial, camadas e narrativa fixada).',
    steps: [{ t: 'Veja as opções', d: 'Peça informações do estoque pelo contato publicado.' }, { t: 'Conte o que procura', d: 'Modelo, ano e se há um veículo para a troca.' }, { t: 'Combine a visita', d: 'Confirme horário e condições com a equipe.' }],
    name: "Showroom noturno", audience: "quem compara carros no celular antes de ir à loja",
    mood: "noir", tones: ["cool", "warm"], fonts: ["Space Grotesk", "Sora", "Syne"], layouts: ["left", "editorial"],
    composition: "foto grande e limpa na abertura, depois vitrine, condições (avaliação do usado, financiamento) e visita; muito espaço e poucos elementos para a foto do carro mandar",
    motion: "movimento contido: profundidade suave na foto e revelações ao rolar, sem carrossel pesado",
    why: "Quem compra carro decide olhando o veículo e conferindo condições. Um showroom escuro faz a foto brilhar e passa seriedade; o telefone e o horário ficam sempre à mão.",
    refs: [R.dealerFeatures, R.dealerTips],
  },
  oficina: {
    key: "oficina", archetype: "spec", structure: 'Ficha de serviço técnica: grade com códigos, passos de orçamento e faixa de alerta. Vem da pesquisa de oficinas (o que consertam, quanto custa, como marcar).',
    steps: [{ t: 'Conte o problema', d: 'Informe o veículo e descreva o que está acontecendo.' }, { t: 'Peça o orçamento', d: 'Envie pelo contato publicado ou use a consulta rápida desta página.' }, { t: 'Combine o dia', d: 'Confirme com a oficina o horário e como acompanhar o serviço.' }],
    name: "Oficina de confiança", audience: "motorista com um problema e pouca paciência para jargão",
    mood: "noir", tones: ["bold", "cool"], fonts: ["Archivo Black", "Anton", "Syne"], layouts: ["left", "right"],
    composition: "o que é consertado, como pedir orçamento e quando abre, nessa ordem; foto real do serviço quando existir",
    motion: "o objeto de oficina escaneado gira devagar ao lado do texto; revelações curtas",
    why: "Quem procura oficina quer três respostas rápidas: o que você conserta, quanto custa e como marcar. Contraste forte e texto direto passam firmeza sem enfeite.",
    refs: [R.repairTop, R.repairGuide, R.repairEstimate],
  },
  autopecas: {
    key: "autopecas", archetype: "display", structure: 'Bloco de cor vivo com título gigante, faixa em movimento e cartões numerados que empilham ao rolar. Inspirada em Lumo (tipografia gigante, ticker, recursos numerados fixos).',
    steps: [{ t: 'Diga o veículo', d: 'Marca, modelo e ano.' }, { t: 'Informe a peça', d: 'O nome ou o código, se souber.' }, { t: 'Combine a retirada', d: 'Confirme prazo e forma de retirada ou entrega.' }],
    name: "Catálogo por veículo", audience: "quem sabe a peça (ou o carro) e quer saber se tem e quando chega",
    mood: "noir", tones: ["cool", "bold"], fonts: ["Space Grotesk", "Sora", "Archivo Black"], layouts: ["editorial", "left"],
    composition: "categorias de peças em grade, consulta por modelo e ano em destaque e contato direto",
    motion: "técnica e precisa: linhas e grade discretas, sem objetos 3D genéricos",
    why: "Em autopeças o visitante procura uma peça específica. A organização por categoria e a consulta por modelo e ano valem mais que um visual teatral.",
    refs: [R.fitment, R.tire],
  },
  pneus: {
    key: "pneus", archetype: "display", structure: 'Bloco de cor vivo com título gigante, faixa em movimento e cartões numerados que empilham ao rolar. Inspirada em Lumo (tipografia gigante, ticker, recursos numerados fixos).',
    steps: [{ t: 'Informe o veículo', d: 'Marca, modelo e ano, ou a medida do pneu.' }, { t: 'Receba as opções', d: 'Peça preço e prazo pelo contato publicado.' }, { t: 'Agende a troca', d: 'Combine o dia e o horário com a loja.' }],
    name: "Pneu certo, hoje", audience: "quem precisa trocar pneu e quer preço e prazo",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Anton", "Archivo Black", "Syne"], layouts: ["left", "center"],
    composition: "medida do pneu ou modelo do veículo na primeira dobra, serviços (alinhamento, balanceamento) e orçamento rápido",
    motion: "rápido e firme: revelações curtas, contraste amarelo e laranja sobre grafite",
    why: "Quem precisa de pneu tem urgência. O site leva da necessidade ao orçamento e ao horário em poucos toques, mantendo o contexto do veículo.",
    refs: [R.tire, R.fitment],
  },
  funilaria: {
    key: "funilaria", archetype: "spec", structure: 'Ficha técnica com códigos de serviço e passos de avaliação, pensada para orçamento por foto.',
    steps: [{ t: 'Fotografe o dano', d: 'Tire fotos do veículo e anote marca, modelo e ano.' }, { t: 'Peça a avaliação', d: 'Combine com a funilaria o envio das fotos pelo contato publicado.' }, { t: 'Confirme o prazo', d: 'Pergunte o prazo e as condições antes de levar o veículo.' }],
    name: "Antes e depois", audience: "quem bateu o carro e precisa de orçamento e de prova de acabamento",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Syne", "Archivo Black", "Anton"], layouts: ["right", "left"],
    composition: "foto do acabamento em destaque, serviços (funilaria, pintura, polimento) e pedido de orçamento por foto",
    motion: "revelação de imagem ao rolar; tons de cobre e vermelho sobre fundo escuro",
    why: "Funilaria e pintura vendem pelo resultado visível. A estrutura prepara espaço para antes e depois reais e para um orçamento por foto.",
    refs: [R.detail, R.detailGallery],
  },
  lavagem: {
    key: "lavagem", archetype: "arc", structure: 'Abertura com arco de luz e partículas sobre fundo escuro, no espírito de Sorvine (tudo feito de luz sobre preto), com o brilho em azul frio.',
    steps: [{ t: 'Escolha o serviço', d: 'Lavagem, polimento ou higienização.' }, { t: 'Agende', d: 'Combine o horário pelo contato publicado.' }, { t: 'Leve o veículo', d: 'Compareça no horário combinado.' }],
    name: "Brilho e resultado", audience: "quem quer o carro impecável e procura um horário",
    mood: "noir", tones: ["cool"], fonts: ["Syne", "Unbounded", "Sora"], layouts: ["center", "editorial"],
    composition: "foto de brilho e espuma na abertura, pacotes de serviço claros, galeria por tipo de serviço e agendamento",
    motion: "reflexos e brilho suaves sobre azul gelo; sem objetos artificiais",
    why: "Estética automotiva se decide pela imagem do resultado. Um fundo escuro com acento frio faz o brilho parecer caro e leva ao agendamento.",
    refs: [R.detail, R.detailGallery],
  },
  vistoria: {
    key: "vistoria", archetype: "spec", structure: 'Ficha técnica com passo a passo e documentos, em fundo claro.',
    steps: [{ t: 'Separe os documentos', d: 'Pergunte ao local quais documentos levar.' }, { t: 'Escolha o horário', d: 'Combine o atendimento pelo contato publicado.' }, { t: 'Leve o veículo', d: 'Compareça no horário combinado.' }],
    name: "Procedimento claro", audience: "quem precisa de vistoria e quer saber o que levar",
    mood: "ivory", tones: ["cool", "earth"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "passo a passo, documentos necessários, horário e agendamento, tudo em leitura fácil",
    motion: "quase nenhum: o serviço é burocrático e o visitante quer rapidez",
    why: "Vistoria é um procedimento. Fundo claro, informação em ordem e um botão de agendar passam mais confiança que qualquer efeito.",
    refs: [R.dealerTips],
  },
  barbearia: {
    key: "barbearia", archetype: "poster", structure: 'Pôster editorial em capítulos, com foto em arco e serviços em lista com pontilhado. Inspirada em Vigil (percurso noturno em capítulos, texto como ensaio).',
    steps: [{ t: 'Escolha o serviço', d: 'Corte, barba ou os dois.' }, { t: 'Reserve o horário', d: 'Combine pelo contato publicado.' }, { t: 'Venha no dia', d: 'Chegue no horário combinado.' }],
    name: "Editorial escuro e dourado", audience: "homens que escolhem a barbearia pelo estilo e pelo ambiente",
    mood: "noir", tones: ["warm", "bold"], fonts: ["Instrument Serif", "Fraunces", "Syne"], layouts: ["editorial", "left"],
    composition: "ambiente e cortes em fotografia grande, serviços em lista enxuta e agendamento no topo",
    motion: "tesoura e navalha como objetos de apoio; transições lentas e luxuosas",
    why: "Barbearia vende atmosfera. O escuro com dourado como acento é o padrão do nicho porque dá status ao corte; o agendamento fica sempre à vista.",
    refs: [R.barber, R.barber2],
  },
  pizzaria: {
    key: "pizzaria", archetype: "plate", structure: 'Prato em destaque num disco central sobre fundo escuro, com cardápio em lista. Inspirada em Brasca (produto revelado sobre preto, comida como protagonista).',
    steps: [{ t: 'Veja o cardápio', d: 'Escolha os sabores e as bebidas.' }, { t: 'Peça ou reserve', d: 'Faça o pedido pelo contato publicado.' }, { t: 'Receba ou venha', d: 'Confirme com a casa se atende no local, retirada ou entrega.' }],
    name: "Forno aceso", audience: "quem está com fome e quer ver a pizza e pedir",
    mood: "noir", tones: ["warm", "bold"], fonts: ["Bricolage Grotesque", "Fraunces", "Anton"], layouts: ["center", "right"],
    composition: "foto grande da pizza, cardápio claro, horário ao vivo (aberta ou fechada) e botão de pedido",
    motion: "calor e brasas no arco de luz; movimento suave e apetitoso",
    why: "Na hora de pedir pizza, o apetite decide primeiro e a conveniência depois. Paleta quente e foto grande abrem o apetite; o status aberto/fechado evita ligar à toa.",
    refs: [R.pizza, R.pizza2],
  },
  hamburgueria: {
    key: "hamburgueria", archetype: "plate", structure: 'Prato em destaque num disco central sobre fundo escuro, com cardápio em lista. Inspirada em Brasca (produto revelado sobre preto, comida como protagonista).',
    steps: [{ t: 'Veja o cardápio', d: 'Escolha o lanche e os acompanhamentos.' }, { t: 'Faça o pedido', d: 'Use o contato publicado.' }, { t: 'Receba ou retire', d: 'Confirme com a casa como será a entrega.' }],
    name: "Chapa e fartura", audience: "quem quer um lanche e decide pela foto",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Anton", "Archivo Black", "Bricolage Grotesque"], layouts: ["right", "center"],
    composition: "foto do hambúrguer em destaque, cardápio direto e botão de pedido",
    motion: "energia e contraste, com títulos grandes e revelações rápidas",
    why: "Lanche é decisão por impulso e por foto. Tipografia pesada e contraste alto combinam com o produto e com a rapidez do pedido.",
    refs: [R.restaurant],
  },
  restaurante: {
    key: "restaurante", archetype: "plate", structure: 'Prato em destaque num disco central, com cardápio em lista e horário em evidência. Inspirada em Brasca (comida como protagonista).',
    steps: [{ t: 'Veja o cardápio', d: 'Confira os pratos e o horário de hoje.' }, { t: 'Peça ou reserve', d: 'Fale pelo contato publicado.' }, { t: 'Venha nos visitar', d: 'Confirme o endereço e o horário.' }],
    name: "Mesa posta", audience: "quem escolhe onde comer pelo prato, pelo ambiente e pelo horário",
    mood: "noir", tones: ["warm", "earth"], fonts: ["Fraunces", "Instrument Serif", "Bricolage Grotesque"], layouts: ["editorial", "left", "center"],
    composition: "foto de prato e de ambiente, cardápio legível, horário e reserva",
    motion: "lento e acolhedor, com profundidade nas fotos",
    why: "Antes de escolher onde comer, o cliente olha prato, ambiente e horário. Serifa calorosa e luz baixa transmitem hospitalidade.",
    refs: [R.restaurant],
  },
  odonto: {
    key: "odonto", archetype: "calm", structure: 'Abertura clara com foto arredondada e cartões flutuantes de horário e endereço, serviços em cartões suaves.',
    steps: [{ t: 'Escolha o horário', d: 'Combine a consulta pelo contato publicado.' }, { t: 'Conte o motivo', d: 'Descreva o que você precisa tratar.' }, { t: 'Compareça', d: 'Vá no dia e no horário combinados.' }],
    name: "Calma e clareza", audience: "pacientes que sentem receio e querem confiança e facilidade para agendar",
    mood: "ivory", tones: ["cool"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "abertura simples com foto real, tratamentos em ordem, equipe e agendamento acessível em um toque",
    motion: "mínimo e suave: a confiança vem da simplicidade, não do efeito",
    why: "Em saúde, o paciente precisa se sentir seguro. Fundo claro, cores calmas e um caminho curto para agendar pesam mais que animações.",
    refs: [R.dental, R.dental2],
  },
  clinica: {
    key: "clinica", archetype: "calm", structure: 'Abertura clara com foto arredondada e cartões flutuantes de horário e endereço, serviços em cartões suaves.',
    steps: [{ t: 'Escolha o horário', d: 'Combine o atendimento pelo contato publicado.' }, { t: 'Conte o motivo', d: 'Descreva o que você precisa.' }, { t: 'Compareça', d: 'Vá no dia e no horário combinados.' }],
    name: "Cuidado sem ruído", audience: "pacientes que procuram atendimento e querem saber como chegar e marcar",
    mood: "ivory", tones: ["cool", "earth"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "especialidades, equipe, horário e agendamento",
    motion: "mínimo e suave",
    why: "Clínicas ganham confiança com informação organizada e visual limpo; o telefone e o horário ficam em evidência.",
    refs: [R.dental2],
  },
  academia: {
    key: "academia", archetype: "display", structure: 'Bloco de cor vivo com título gigante e cartões numerados. Inspirada em Lumo (energia, tipografia gigante).',
    steps: [{ t: 'Conheça a estrutura', d: 'Veja as fotos e as modalidades.' }, { t: 'Peça a aula experimental', d: 'Combine pelo contato publicado.' }, { t: 'Escolha o seu plano', d: 'Converse com a equipe sobre as opções.' }],
    name: "Energia em preto e acento", audience: "quem quer começar ou voltar a treinar e procura motivação e estrutura",
    mood: "noir", tones: ["bold", "cool"], fonts: ["Anton", "Syne", "Archivo Black"], layouts: ["left", "editorial"],
    composition: "título enorme, fotos da estrutura, modalidades e chamada para a aula experimental",
    motion: "intensidade controlada: deslocamento de profundidade e revelações rápidas",
    why: "Academia vende disposição. Contraste alto e tipografia condensada criam energia, e a aula experimental vira a ação principal.",
    refs: [R.gym, R.gym2],
  },
  salao: {
    key: "salao", archetype: "poster", structure: "Pôster editorial com foto em arco e serviços em lista pontilhada, em tom claro.",
    name: "Atelier claro", audience: "quem escolhe salão pelos trabalhos e pelo ambiente",
    mood: "ivory", tones: ["soft"], fonts: ["Instrument Serif", "Cormorant Garamond", "Fraunces"], layouts: ["editorial", "left"],
    composition: "fotos de trabalhos e do ambiente, serviços em lista e agendamento", motion: "suave e elegante, sem objetos artificiais",
    why: "Em beleza, a decisão vem do olhar. Fundo claro e serifa fina dão sofisticação e deixam as fotos respirarem.", refs: [],
  },
  estetica: {
    key: "estetica", archetype: "calm", structure: "Abertura clara com foto arredondada e cartões flutuantes, serviços em cartões suaves.",
    name: "Bem-estar sereno", audience: "quem procura cuidado e tranquilidade",
    mood: "ivory", tones: ["soft"], fonts: ["Cormorant Garamond", "Instrument Serif", "Sora"], layouts: ["left", "center"],
    composition: "ambiente, tratamentos e agendamento", motion: "mínimo e suave",
    why: "Estética vende calma. Cores suaves, formas arredondadas e pouco movimento combinam com o cuidado oferecido.", refs: [],
  },
  pet: {
    key: "pet", archetype: "calm", structure: "Abertura clara e amigável com foto arredondada e cartões flutuantes.",
    name: "Casa dos bichos", audience: "tutores que querem confiança e praticidade",
    mood: "ivory", tones: ["warm", "soft"], fonts: ["Bricolage Grotesque", "Sora", "Fraunces"], layouts: ["left", "center"],
    composition: "serviços (banho e tosa, produtos), horário e agendamento", motion: "leve e simpático",
    why: "O tutor quer sentir que o pet será bem cuidado. Cores quentes e formas macias passam acolhimento.", refs: [],
  },
  padaria: {
    key: "padaria", archetype: "calm", structure: "Abertura clara e quente com foto arredondada, vitrine em cartões suaves.",
    name: "Vitrine do dia", audience: "quem passa pela vizinhança e quer saber o que tem e até quando abre",
    mood: "ivory", tones: ["warm", "earth"], fonts: ["Fraunces", "Instrument Serif", "Bricolage Grotesque"], layouts: ["left", "right"],
    composition: "produtos em destaque, horário ao vivo e como chegar", motion: "calmo",
    why: "Padaria é rotina de bairro. Tom claro e quente e informação direta sobre horário atendem quem decide na hora.", refs: [],
  },
  cafe: {
    key: "cafe", archetype: "plate", structure: "Xícara ou prato num disco central sobre fundo escuro, cardápio em lista.",
    name: "Pausa em penumbra", audience: "quem procura um lugar para parar e saborear",
    mood: "noir", tones: ["warm", "earth"], fonts: ["Fraunces", "Instrument Serif", "Bricolage Grotesque"], layouts: ["center", "left"],
    composition: "foto central, cardápio e horário", motion: "lento e acolhedor",
    why: "Café é atmosfera. Penumbra e foto central criam o clima de pausa.", refs: [],
  },
  confeitaria: {
    key: "confeitaria", archetype: "plate", structure: "Doce em destaque num disco central, vitrine em lista.",
    name: "Vitrine de doces", audience: "quem escolhe doces e encomendas pela foto",
    mood: "ivory", tones: ["soft", "warm"], fonts: ["Fraunces", "Instrument Serif", "Cormorant Garamond"], layouts: ["center", "right"],
    composition: "foto do doce, vitrine e botão de encomenda", motion: "suave",
    why: "Doce se decide pelo olhar. A foto central e o tom claro valorizam cor e textura.", refs: [],
  },
  roupas: {
    key: "roupas", archetype: "poster", structure: "Pôster editorial com foto em arco e coleções em lista.",
    name: "Lookbook", audience: "quem compra roupa olhando fotos",
    mood: "ivory", tones: ["soft", "earth"], fonts: ["Instrument Serif", "Syne", "Cormorant Garamond"], layouts: ["editorial", "right"],
    composition: "foto grande, destaques da vitrine e contato rápido", motion: "elegante, com revelações lentas",
    why: "Moda se vende por imagem. Composição de revista e serifa fina dão assinatura à loja.", refs: [],
  },
  imobiliaria: {
    key: "imobiliaria", archetype: "showroom", structure: "Foto em tela cheia com título na base e faixa de dados, serviços em linhas.",
    name: "Fachada e confiança", audience: "quem busca um imóvel e quer segurança",
    mood: "noir", tones: ["warm", "cool"], fonts: ["Sora", "Fraunces", "Space Grotesk"], layouts: ["left", "editorial"],
    composition: "foto do imóvel ou da cidade, serviços e contato com corretor", motion: "contido",
    why: "Imóvel é decisão grande. Foto ampla e informação organizada transmitem seriedade.", refs: [],
  },
  otica: {
    key: "otica", archetype: "calm", structure: "Abertura clara com foto arredondada e cartões flutuantes.",
    name: "Olhar limpo", audience: "quem escolhe armações e quer atendimento",
    mood: "ivory", tones: ["cool", "warm"], fonts: ["Sora", "Manrope", "Instrument Serif"], layouts: ["left", "center"],
    composition: "vitrine de armações, exame e contato", motion: "mínimo",
    why: "Ótica pede clareza e estilo. Fundo claro e foto nítida destacam as armações.", refs: [],
  },
  construcao: {
    key: "construcao", archetype: "spec", structure: "Ficha técnica com códigos de serviço e passos de orçamento.",
    steps: [{ t: "Descreva a obra", d: "Informe o tipo de serviço e o local." }, { t: "Peça o orçamento", d: "Envie pelo contato publicado ou pela consulta rápida." }, { t: "Combine a visita", d: "Confirme com a empresa o dia da visita técnica." }],
    name: "Obra planejada", audience: "quem precisa de materiais ou de uma obra e quer orçamento",
    mood: "noir", tones: ["bold", "earth"], fonts: ["Archivo Black", "Anton", "Syne"], layouts: ["left", "right"],
    composition: "serviços, fotos de obras e pedido de orçamento", motion: "firme e direto",
    why: "Obra é investimento. Estrutura técnica e contraste forte passam solidez e levam ao orçamento.", refs: [],
  },
};

const DEFAULT: DesignDirection = {
  key: "servicos", archetype: "arc", structure: "Abertura com arco de luz e painel, a estrutura padrão para ramos sem direção própria.", name: "Serviço claro e direto", audience: "quem procura o serviço e quer contato rápido",
  mood: "noir", tones: ["cool", "warm"], fonts: ["Sora", "Space Grotesk", "Bricolage Grotesque"], layouts: ["left", "center"],
  composition: "serviços, horário ao vivo e contato rápido, em ordem simples",
  motion: "discreto: revelações curtas e foto em profundidade",
  why: "Sem pesquisa própria para este ramo ainda, a direção é conservadora: informação clara, contato à mão e um visual sóbrio.",
  refs: [],
};

/** Direção do ramo: o segmento do projeto manda; o texto (nome e categoria) refina. */
export function designDirectionFor(segmentKey: string | null | undefined, text = ""): DesignDirection {
  const ALIAS: Record<string, string> = { odontologia: "odonto", petshop: "pet" };
  const bySeg = segmentKey && segmentKey !== "servicos" ? D[ALIAS[segmentKey] ?? segmentKey] : undefined;
  const byText = D[nicheFromText(text).key];
  // Ramo automotivo específico no texto vence o segmento genérico (ex.: oficina que vende pneus).
  const auto = ["concessionaria", "autopecas", "pneus", "funilaria", "lavagem", "vistoria"];
  if (byText && auto.includes(byText.key) && (!bySeg || bySeg.key === "oficina")) return byText;
  return bySeg ?? byText ?? DEFAULT;
}
