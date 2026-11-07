// Biblioteca de textos por setor, usada quando a IA não está configurada (ou como base para ela).
// Regras: nada de afirmações que precisem ser verificadas (anos de casa, prêmios, "o melhor",
// números, avaliações). O texto descreve o tipo de serviço e convida ao contato; fatos da
// empresa (nome, bairro, horários) entram só quando vieram confirmados.

export type SectorCopy = {
  kicker: string;
  tagline: () => string;
  about: (name: string, where: string) => string;
  servicesIntro: string;
  ctaTitle: (where: string) => string;
  ctaText: string;
};

/** `place` já vem com preposição ("no bairro Centro, em Curitiba" / "em Curitiba"). */
const at = (place: string, _pre?: string) => (place ? ` ${place}` : "");

/** Monta o local com preposição correta para o texto corrido. */
export function placePhrase(neighborhood?: string | null, city?: string | null): string {
  if (neighborhood && city) return `no bairro ${neighborhood}, em ${city}`;
  if (city) return `em ${city}`;
  if (neighborhood) return `no bairro ${neighborhood}`;
  return "";
}

export const SECTOR_COPY: Record<string, SectorCopy> = {
  barbearia: {
    kicker: "Barbearia",
    tagline: () => `Corte, barba e acabamento no detalhe.`,
    about: (n, w) => `A ${n} é uma barbearia${at(w)}. Aqui o corte é conversado antes da tesoura: estilo, rotina e o tempo que você quer gastar arrumando o cabelo.`,
    servicesIntro: "Do corte clássico à barba desenhada. Confirme valores e horários direto com a equipe.",
    ctaTitle: () => "Sua próxima cadeira está livre?",
    ctaText: "Mande uma mensagem e combine o melhor horário.",
  },
  salao: {
    kicker: "Salão de beleza",
    tagline: () => `Cabelo, unhas e cuidado com calma.`,
    about: (n, w) => `O ${n} é um salão de beleza${at(w)}. Cada atendimento começa ouvindo o que você quer, para o resultado combinar com você e com a sua rotina.`,
    servicesIntro: "Serviços do dia a dia e para ocasiões especiais. Consulte a disponibilidade com a equipe.",
    ctaTitle: () => "Reserve um tempo para você",
    ctaText: "Fale com o salão e combine seu horário.",
  },
  restaurante: {
    kicker: "Restaurante",
    tagline: () => `Comida feita com cuidado, do jeito da casa.`,
    about: (n, w) => `O ${n} é um restaurante${at(w)}. Um lugar para sentar, comer bem e voltar.`,
    servicesIntro: "Conheça a casa e fale com a gente para saber o cardápio do dia.",
    ctaTitle: () => "Bateu a fome?",
    ctaText: "Fale com a casa para reservas, pedidos e cardápio.",
  },
  cafe: {
    kicker: "Café",
    tagline: () => `Café bem tirado, sem pressa.`,
    about: (n, w) => `O ${n} é um café${at(w)}. Um lugar para uma pausa boa, do espresso ao café coado.`,
    servicesIntro: "Cafés, bebidas e o que mais estiver no balcão hoje. Pergunte à equipe.",
    ctaTitle: () => "Passa para um café?",
    ctaText: "Fale com a casa para saber horários e novidades.",
  },
  pizzaria: {
    kicker: "Pizzaria",
    tagline: () => `Massa, forno e sabor de pizzaria de verdade.`,
    about: (n, w) => `A ${n} é uma pizzaria${at(w)}. Pizza para dividir na mesa ou levar para casa.`,
    servicesIntro: "Sabores, bebidas e pedidos. Confira o cardápio com a casa.",
    ctaTitle: () => "Hoje é dia de pizza?",
    ctaText: "Fale com a casa para pedidos e reservas.",
  },
  padaria: {
    kicker: "Padaria",
    tagline: () => `Pão quente, café e o lanche do bairro.`,
    about: (n, w) => `A ${n} é uma padaria${at(w)}. Do café da manhã ao lanche da tarde, é o tipo de lugar que entra na rotina.`,
    servicesIntro: "Fornadas, salgados e encomendas. Pergunte o que sai do forno hoje.",
    ctaTitle: () => "Encomendas e fornadas",
    ctaText: "Fale com a padaria para saber horários de fornada e encomendas.",
  },
  odontologia: {
    kicker: "Odontologia",
    tagline: () => `Cuidado com o seu sorriso, sem pressa.`,
    about: (n, w) => `A ${n} é uma clínica odontológica${at(w)}. A primeira conversa serve para entender o que você precisa e explicar cada etapa com clareza.`,
    servicesIntro: "Tratamentos e prevenção. Agende uma avaliação para saber o que se aplica ao seu caso.",
    ctaTitle: () => "Agende sua avaliação",
    ctaText: "Fale com a recepção e escolha o melhor horário.",
  },
  clinica: {
    kicker: "Clínica",
    tagline: () => `Atendimento de saúde com atenção.`,
    about: (n, w) => `A ${n} é uma clínica${at(w)}. Cada consulta começa ouvindo você, com explicações claras sobre os próximos passos.`,
    servicesIntro: "Especialidades e exames. Confirme a disponibilidade com a recepção.",
    ctaTitle: () => "Marque sua consulta",
    ctaText: "Fale com a recepção para agendar.",
  },
  academia: {
    kicker: "Academia",
    tagline: () => `Treino com orientação e espaço para evoluir.`,
    about: (n, w) => `A ${n} é uma academia${at(w)}. Um espaço para treinar com constância, no seu ritmo, com orientação quando você precisar.`,
    servicesIntro: "Musculação, condicionamento e acompanhamento. Pergunte sobre planos e horários.",
    ctaTitle: () => "Comece seu treino",
    ctaText: "Fale com a equipe e conheça a estrutura.",
  },
  concessionaria: {
    kicker: "Veículos",
    tagline: () => `Veículos para cada rotina.`,
    about: (n, w) => `A ${n} trabalha com venda de veículos${at(w)}. Fale com a equipe para conhecer o estoque do momento, as condições de pagamento e a avaliação do seu usado.`,
    servicesIntro: "Confirme com a loja o estoque atual, as condições de financiamento e a avaliação do seu veículo.",
    ctaTitle: () => "Procurando o seu próximo carro?",
    ctaText: "Fale com um vendedor e combine uma visita.",
  },
  autopecas: {
    kicker: "Autopeças",
    tagline: () => `A peça certa para o seu veículo.`,
    about: (n, w) => `A ${n} é uma loja de autopeças${at(w)}. Informe o modelo e o ano do veículo e consulte a disponibilidade da peça pelo telefone.`,
    servicesIntro: "Consulte a disponibilidade e o prazo da peça que você procura.",
    ctaTitle: () => "Precisa de uma peça?",
    ctaText: "Informe modelo e ano do veículo e consulte a disponibilidade.",
  },
  pneus: {
    kicker: "Pneus",
    tagline: () => `Pneus, rodas e alinhamento.`,
    about: (n, w) => `A ${n} atende com pneus e serviços de borracharia${at(w)}. Informe a medida do pneu ou o modelo do veículo e peça um orçamento.`,
    servicesIntro: "Peça o orçamento informando a medida do pneu ou o modelo do veículo.",
    ctaTitle: () => "Hora de trocar os pneus?",
    ctaText: "Informe a medida ou o modelo do veículo e receba um orçamento.",
  },
  funilaria: {
    kicker: "Funilaria e pintura",
    tagline: () => `Reparo e pintura com acabamento.`,
    about: (n, w) => `A ${n} faz serviços de funilaria e pintura automotiva${at(w)}. Envie fotos do dano e combine a avaliação para receber um orçamento.`,
    servicesIntro: "Reparos de lataria e pintura. Peça uma avaliação do seu veículo.",
    ctaTitle: () => "Seu carro precisa de reparo?",
    ctaText: "Conte o que aconteceu e peça uma avaliação.",
  },
  lavagem: {
    kicker: "Estética automotiva",
    tagline: () => `Brilho e cuidado para o seu carro.`,
    about: (n, w) => `A ${n} cuida da limpeza e da estética do seu veículo${at(w)}. Pergunte sobre os serviços disponíveis e combine um horário.`,
    servicesIntro: "Consulte os serviços de lavagem e estética e os horários disponíveis.",
    ctaTitle: () => "Quer o carro brilhando?",
    ctaText: "Combine um horário e conheça os serviços.",
  },
  vistoria: {
    kicker: "Vistoria veicular",
    tagline: () => `Inspeção com hora marcada.`,
    about: (n, w) => `A ${n} realiza serviços de vistoria e inspeção veicular${at(w)}. Pergunte quais documentos levar e agende o seu horário.`,
    servicesIntro: "Confirme os serviços, os documentos necessários e os horários.",
    ctaTitle: () => "Precisa de uma vistoria?",
    ctaText: "Agende o horário e confirme os documentos.",
  },
  oficina: {
    kicker: "Oficina mecânica",
    tagline: () => `Diagnóstico claro e serviço bem feito.`,
    about: (n, w) => `A ${n} é uma oficina mecânica${at(w)}. Antes de qualquer serviço, o problema é avaliado e explicado, com orçamento combinado.`,
    servicesIntro: "Manutenção preventiva e corretiva. Peça um orçamento para o seu veículo.",
    ctaTitle: () => "Seu carro precisa de atenção?",
    ctaText: "Conte o que está acontecendo e receba um orçamento.",
  },
  roupas: {
    kicker: "Moda",
    tagline: () => `Peças escolhidas a dedo.`,
    about: (n, w) => `A ${n} é uma loja de roupas${at(w)}. Uma curadoria para o dia a dia e para ocasiões especiais, com atendimento próximo.`,
    servicesIntro: "Novidades chegam com frequência. Pergunte por tamanhos e cores disponíveis.",
    ctaTitle: () => "Viu algo que gostou?",
    ctaText: "Fale com a loja e confira a disponibilidade.",
  },
  petshop: {
    kicker: "Pet shop",
    tagline: () => `Banho, tosa e cuidado para o seu pet.`,
    about: (n, w) => `A ${n} é um pet shop${at(w)}. Um lugar para cuidar do seu bicho com paciência e carinho.`,
    servicesIntro: "Banho, tosa e produtos. Combine o horário com a equipe.",
    ctaTitle: () => "Hora do banho?",
    ctaText: "Fale com a equipe e agende.",
  },
  imobiliaria: {
    kicker: "Imobiliária",
    tagline: () => `Imóveis para comprar e alugar.`,
    about: (n, w) => `A ${n} é uma imobiliária${at(w)}. Atendimento para quem procura, vende ou aluga um imóvel, com cada passo explicado.`,
    servicesIntro: "Venda, locação e avaliação. Conte o que você procura.",
    ctaTitle: () => "Procurando um imóvel?",
    ctaText: "Diga o que você precisa e receba opções.",
  },
  construcao: {
    kicker: "Construção",
    tagline: () => `Obras e reformas com planejamento.`,
    about: (n, w) => `A ${n} atua com construção e reformas${at(w)}. Cada projeto começa com visita, escopo e orçamento claros.`,
    servicesIntro: "Construção, reforma e manutenção. Solicite uma visita técnica.",
    ctaTitle: () => "Tem uma obra em mente?",
    ctaText: "Conte sobre o projeto e peça um orçamento.",
  },
  servicos: {
    kicker: "Serviços",
    tagline: () => `Atendimento próximo e trabalho bem feito.`,
    about: (n, w) => `A ${n} atende${at(w)}. O trabalho começa entendendo a sua necessidade, com orçamento combinado antes de começar.`,
    servicesIntro: "Conheça os serviços e fale com a gente para um orçamento.",
    ctaTitle: () => "Vamos conversar?",
    ctaText: "Conte o que você precisa.",
  },
};

export function sectorCopy(key: string, hint = ""): SectorCopy | null {
  // A categoria/nome refinam o segmento: um café ou uma pizzaria não recebem textos genéricos de restaurante.
  const h = hint.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (["restaurante", "padaria", "servicos", ""].includes(key)) {
    if (/\b(cafe|cafeteria|coffee)\b/.test(h)) return SECTOR_COPY.cafe!;
    if (/pizz/.test(h)) return SECTOR_COPY.pizzaria!;
  }
  return SECTOR_COPY[key] ?? null;
}

/** Usa a descrição do site oficial só se for texto de verdade (não SEO genérico nem lista de palavras). */
export function usableOwnDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 60 || t.length > 400) return null;
  if ((t.match(/,/g)?.length ?? 0) > 8 || /\|/.test(t)) return null; // lista de palavras-chave
  if (!/[.!?]$/.test(t) && t.split(" ").length < 12) return null;
  // Avaliações, notas e superlativos não verificáveis não entram no site (mesmo vindo do site da empresa).
  if (/★|☆|\bestrelas?\b|avalia[cç][oõ]es|\bnota\b|\b[0-5][.,]\d\b|\bo melhor\b|\ba melhor\b|\bos melhores\b|n[ºo°]\s?1\b|número 1|\blíder\b|\bpremiad/i.test(t)) return null;
  return t;
}
