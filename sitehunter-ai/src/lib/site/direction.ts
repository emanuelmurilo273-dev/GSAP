import { nicheFromText, type NicheKey } from "./nicheProfile";

// Direção visual por ramo. Cada direção responde: quem decide aqui, o que essa pessoa precisa ver primeiro,
// e que linguagem (cor, tipografia, composição, movimento) sustenta isso. As referências são páginas de
// inspiração consultadas em novembro de 2026 (busca na web): servem de contexto, não são copiadas, e vários
// links são de agências ou vendedores de template, então tratam-se como opinião, não como dado.
// Ramos sem referências listadas ainda não tiveram pesquisa própria e usam uma direção conservadora.

export type Ref = { title: string; url: string; takeaway: string };
export type DesignDirection = {
  key: NicheKey | "servicos";
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
    key: "concessionaria", name: "Showroom noturno", audience: "quem compara carros no celular antes de ir à loja",
    mood: "noir", tones: ["cool", "warm"], fonts: ["Space Grotesk", "Sora", "Syne"], layouts: ["left", "editorial"],
    composition: "foto grande e limpa na abertura, depois vitrine, condições (avaliação do usado, financiamento) e visita; muito espaço e poucos elementos para a foto do carro mandar",
    motion: "movimento contido: profundidade suave na foto e revelações ao rolar, sem carrossel pesado",
    why: "Quem compra carro decide olhando o veículo e conferindo condições. Um showroom escuro faz a foto brilhar e passa seriedade; o telefone e o horário ficam sempre à mão.",
    refs: [R.dealerFeatures, R.dealerTips],
  },
  oficina: {
    key: "oficina", name: "Oficina de confiança", audience: "motorista com um problema e pouca paciência para jargão",
    mood: "noir", tones: ["bold", "cool"], fonts: ["Archivo Black", "Anton", "Syne"], layouts: ["left", "right"],
    composition: "o que é consertado, como pedir orçamento e quando abre, nessa ordem; foto real do serviço quando existir",
    motion: "o objeto de oficina escaneado gira devagar ao lado do texto; revelações curtas",
    why: "Quem procura oficina quer três respostas rápidas: o que você conserta, quanto custa e como marcar. Contraste forte e texto direto passam firmeza sem enfeite.",
    refs: [R.repairTop, R.repairGuide, R.repairEstimate],
  },
  autopecas: {
    key: "autopecas", name: "Catálogo por veículo", audience: "quem sabe a peça (ou o carro) e quer saber se tem e quando chega",
    mood: "noir", tones: ["cool", "bold"], fonts: ["Space Grotesk", "Sora", "Archivo Black"], layouts: ["editorial", "left"],
    composition: "categorias de peças em grade, consulta por modelo e ano em destaque e contato direto",
    motion: "técnica e precisa: linhas e grade discretas, sem objetos 3D genéricos",
    why: "Em autopeças o visitante procura uma peça específica. A organização por categoria e a consulta por modelo e ano valem mais que um visual teatral.",
    refs: [R.fitment, R.tire],
  },
  pneus: {
    key: "pneus", name: "Pneu certo, hoje", audience: "quem precisa trocar pneu e quer preço e prazo",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Anton", "Archivo Black", "Syne"], layouts: ["left", "center"],
    composition: "medida do pneu ou modelo do veículo na primeira dobra, serviços (alinhamento, balanceamento) e orçamento rápido",
    motion: "rápido e firme: revelações curtas, contraste amarelo e laranja sobre grafite",
    why: "Quem precisa de pneu tem urgência. O site leva da necessidade ao orçamento e ao horário em poucos toques, mantendo o contexto do veículo.",
    refs: [R.tire, R.fitment],
  },
  funilaria: {
    key: "funilaria", name: "Antes e depois", audience: "quem bateu o carro e precisa de orçamento e de prova de acabamento",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Syne", "Archivo Black", "Anton"], layouts: ["right", "left"],
    composition: "foto do acabamento em destaque, serviços (funilaria, pintura, polimento) e pedido de orçamento por foto",
    motion: "revelação de imagem ao rolar; tons de cobre e vermelho sobre fundo escuro",
    why: "Funilaria e pintura vendem pelo resultado visível. A estrutura prepara espaço para antes e depois reais e para um orçamento por foto.",
    refs: [R.detail, R.detailGallery],
  },
  lavagem: {
    key: "lavagem", name: "Brilho e resultado", audience: "quem quer o carro impecável e procura um horário",
    mood: "noir", tones: ["cool"], fonts: ["Syne", "Unbounded", "Sora"], layouts: ["center", "editorial"],
    composition: "foto de brilho e espuma na abertura, pacotes de serviço claros, galeria por tipo de serviço e agendamento",
    motion: "reflexos e brilho suaves sobre azul gelo; sem objetos artificiais",
    why: "Estética automotiva se decide pela imagem do resultado. Um fundo escuro com acento frio faz o brilho parecer caro e leva ao agendamento.",
    refs: [R.detail, R.detailGallery],
  },
  vistoria: {
    key: "vistoria", name: "Procedimento claro", audience: "quem precisa de vistoria e quer saber o que levar",
    mood: "ivory", tones: ["cool", "earth"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "passo a passo, documentos necessários, horário e agendamento, tudo em leitura fácil",
    motion: "quase nenhum: o serviço é burocrático e o visitante quer rapidez",
    why: "Vistoria é um procedimento. Fundo claro, informação em ordem e um botão de agendar passam mais confiança que qualquer efeito.",
    refs: [R.dealerTips],
  },
  barbearia: {
    key: "barbearia", name: "Editorial escuro e dourado", audience: "homens que escolhem a barbearia pelo estilo e pelo ambiente",
    mood: "noir", tones: ["warm", "bold"], fonts: ["Instrument Serif", "Fraunces", "Syne"], layouts: ["editorial", "left"],
    composition: "ambiente e cortes em fotografia grande, serviços em lista enxuta e agendamento no topo",
    motion: "tesoura e navalha como objetos de apoio; transições lentas e luxuosas",
    why: "Barbearia vende atmosfera. O escuro com dourado como acento é o padrão do nicho porque dá status ao corte; o agendamento fica sempre à vista.",
    refs: [R.barber, R.barber2],
  },
  pizzaria: {
    key: "pizzaria", name: "Forno aceso", audience: "quem está com fome e quer ver a pizza e pedir",
    mood: "noir", tones: ["warm", "bold"], fonts: ["Bricolage Grotesque", "Fraunces", "Anton"], layouts: ["center", "right"],
    composition: "foto grande da pizza, cardápio claro, horário ao vivo (aberta ou fechada) e botão de pedido",
    motion: "calor e brasas no arco de luz; movimento suave e apetitoso",
    why: "Na hora de pedir pizza, o apetite decide primeiro e a conveniência depois. Paleta quente e foto grande abrem o apetite; o status aberto/fechado evita ligar à toa.",
    refs: [R.pizza, R.pizza2],
  },
  hamburgueria: {
    key: "hamburgueria", name: "Chapa e fartura", audience: "quem quer um lanche e decide pela foto",
    mood: "noir", tones: ["bold", "warm"], fonts: ["Anton", "Archivo Black", "Bricolage Grotesque"], layouts: ["right", "center"],
    composition: "foto do hambúrguer em destaque, cardápio direto e botão de pedido",
    motion: "energia e contraste, com títulos grandes e revelações rápidas",
    why: "Lanche é decisão por impulso e por foto. Tipografia pesada e contraste alto combinam com o produto e com a rapidez do pedido.",
    refs: [R.restaurant],
  },
  restaurante: {
    key: "restaurante", name: "Mesa posta", audience: "quem escolhe onde comer pelo prato, pelo ambiente e pelo horário",
    mood: "noir", tones: ["warm", "earth"], fonts: ["Fraunces", "Instrument Serif", "Bricolage Grotesque"], layouts: ["editorial", "left", "center"],
    composition: "foto de prato e de ambiente, cardápio legível, horário e reserva",
    motion: "lento e acolhedor, com profundidade nas fotos",
    why: "Antes de escolher onde comer, o cliente olha prato, ambiente e horário. Serifa calorosa e luz baixa transmitem hospitalidade.",
    refs: [R.restaurant],
  },
  odonto: {
    key: "odonto", name: "Calma e clareza", audience: "pacientes que sentem receio e querem confiança e facilidade para agendar",
    mood: "ivory", tones: ["cool"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "abertura simples com foto real, tratamentos em ordem, equipe e agendamento acessível em um toque",
    motion: "mínimo e suave: a confiança vem da simplicidade, não do efeito",
    why: "Em saúde, o paciente precisa se sentir seguro. Fundo claro, cores calmas e um caminho curto para agendar pesam mais que animações.",
    refs: [R.dental, R.dental2],
  },
  clinica: {
    key: "clinica", name: "Cuidado sem ruído", audience: "pacientes que procuram atendimento e querem saber como chegar e marcar",
    mood: "ivory", tones: ["cool", "earth"], fonts: ["Sora", "Manrope", "Bricolage Grotesque"], layouts: ["left", "center"],
    composition: "especialidades, equipe, horário e agendamento",
    motion: "mínimo e suave",
    why: "Clínicas ganham confiança com informação organizada e visual limpo; o telefone e o horário ficam em evidência.",
    refs: [R.dental2],
  },
  academia: {
    key: "academia", name: "Energia em preto e acento", audience: "quem quer começar ou voltar a treinar e procura motivação e estrutura",
    mood: "noir", tones: ["bold", "cool"], fonts: ["Anton", "Syne", "Archivo Black"], layouts: ["left", "editorial"],
    composition: "título enorme, fotos da estrutura, modalidades e chamada para a aula experimental",
    motion: "intensidade controlada: deslocamento de profundidade e revelações rápidas",
    why: "Academia vende disposição. Contraste alto e tipografia condensada criam energia, e a aula experimental vira a ação principal.",
    refs: [R.gym, R.gym2],
  },
};

const DEFAULT: DesignDirection = {
  key: "servicos", name: "Serviço claro e direto", audience: "quem procura o serviço e quer contato rápido",
  mood: "noir", tones: ["cool", "warm"], fonts: ["Sora", "Space Grotesk", "Bricolage Grotesque"], layouts: ["left", "center"],
  composition: "serviços, horário ao vivo e contato rápido, em ordem simples",
  motion: "discreto: revelações curtas e foto em profundidade",
  why: "Sem pesquisa própria para este ramo ainda, a direção é conservadora: informação clara, contato à mão e um visual sóbrio.",
  refs: [],
};

/** Direção do ramo: o segmento do projeto manda; o texto (nome e categoria) refina. */
export function designDirectionFor(segmentKey: string | null | undefined, text = ""): DesignDirection {
  const bySeg = segmentKey && segmentKey !== "servicos" ? (segmentKey === "odontologia" ? D.odonto : D[segmentKey]) : undefined;
  const byText = D[nicheFromText(text).key];
  // Ramo automotivo específico no texto vence o segmento genérico (ex.: oficina que vende pneus).
  const auto = ["concessionaria", "autopecas", "pneus", "funilaria", "lavagem", "vistoria"];
  if (byText && auto.includes(byText.key) && (!bySeg || bySeg.key === "oficina")) return byText;
  return bySeg ?? byText ?? DEFAULT;
}
