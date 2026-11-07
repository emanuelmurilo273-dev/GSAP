import type { ModelKind } from "./immersive/kinds";

// Perfil de cada ramo: linguagem visual (tipo de brilho do arco da abertura), conteúdo típico do ramo e
// o ângulo da abordagem. Os itens de "chips" são a TIPOLOGIA do ramo (o que costuma existir nele), não
// afirmações sobre uma empresa específica: nos sites e nas revisões aparecem sinalizados para confirmação.

export type Glow = "fire" | "gold" | "neon" | "sparks" | "halo" | "pulse";
export type NicheKey =
  | "barbearia" | "pizzaria" | "hamburgueria" | "restaurante" | "cafe" | "padaria" | "confeitaria" | "salao" | "estetica"
  | "odonto" | "clinica" | "academia" | "oficina" | "roupas" | "pet" | "imobiliaria" | "otica" | "construcao" | "generico";

export type Niche = {
  key: NicheKey;
  label: string;
  /** Efeito do arco: fogo/brasas, brasas douradas, neon, faíscas, halo suave, pulsos. */
  glow: Glow;
  /** Frase curta da faixa de abertura quando não há status de funcionamento. */
  tagline: string;
  /** Tipologia do ramo (a confirmar com a empresa). */
  chips: string[];
  /** Título do painel que sobe da abertura. */
  panelTitle: string;
  /** Texto do botão de destaque do painel. */
  panelCta: string;
  /** Abordagem: o que o site sugerido entrega para esse ramo e por que importa. */
  offer: string;
  why: string;
  /** Detalhe visual próprio do ramo. */
  accent?: "pole" | "checker" | "stripe";
};

export const NICHES: Record<NicheKey, Niche> = {
  barbearia: { key: "barbearia", label: "barbearia", glow: "neon", tagline: "Corte, barba e estilo", chips: ["Degradê", "Corte social", "Navalhado", "Barba desenhada", "Pigmentação", "Sobrancelha"], panelTitle: "Cortes e estilos", panelCta: "Agendar horário", offer: "cortes e estilos em destaque, fotos do ambiente e agendamento direto pelo WhatsApp", why: "Quem escolhe barbearia costuma olhar fotos de corte e do ambiente antes de marcar horário.", accent: "pole" },
  pizzaria: { key: "pizzaria", label: "pizzaria", glow: "fire", tagline: "Sabores para pedir e dividir", chips: ["Pizzas salgadas", "Pizzas doces", "Bebidas", "Sobremesas"], panelTitle: "Cardápio em destaque", panelCta: "Fazer pedido", offer: "cardápio com fotos, horário de funcionamento ao vivo e botão de pedido", why: "Na hora de pedir pizza, o cliente compara cardápio e se a casa está aberta antes de ligar.", accent: "checker" },
  hamburgueria: { key: "hamburgueria", label: "hamburgueria", glow: "fire", tagline: "Feito para matar a fome", chips: ["Hambúrgueres", "Batatas", "Bebidas", "Sobremesas"], panelTitle: "Cardápio em destaque", panelCta: "Fazer pedido", offer: "cardápio com fotos, status de aberto/fechado e botão de pedido", why: "Quem busca hambúrguer decide pela foto e pela facilidade de pedir." },
  restaurante: { key: "restaurante", label: "restaurante", glow: "fire", tagline: "Mesa posta, bom apetite", chips: ["Pratos do dia", "Entradas", "Sobremesas", "Bebidas"], panelTitle: "Cardápio e reservas", panelCta: "Reservar mesa", offer: "cardápio, fotos do ambiente, horário ao vivo e reserva pelo WhatsApp", why: "Antes de escolher onde comer, o cliente olha cardápio, ambiente e horário." },
  cafe: { key: "cafe", label: "café", glow: "gold", tagline: "Café e boa companhia", chips: ["Cafés", "Doces e salgados", "Café da manhã", "Bebidas geladas"], panelTitle: "Para a sua pausa", panelCta: "Ver como chegar", offer: "cardápio, fotos do ambiente e horário ao vivo", why: "Quem procura café perto confere ambiente e se está aberto." },
  padaria: { key: "padaria", label: "padaria", glow: "gold", tagline: "Pães e doces todos os dias", chips: ["Pães", "Doces", "Salgados", "Café da manhã"], panelTitle: "Da vitrine para a mesa", panelCta: "Ver como chegar", offer: "vitrine de produtos com fotos e horário de funcionamento ao vivo", why: "O cliente da padaria quer saber o que tem e até que horas está aberta." },
  confeitaria: { key: "confeitaria", label: "confeitaria", glow: "gold", tagline: "Doces para cada ocasião", chips: ["Bolos", "Doces finos", "Tortas", "Encomendas"], panelTitle: "Doces e encomendas", panelCta: "Fazer encomenda", offer: "vitrine de bolos e doces com fotos e botão de encomenda", why: "Encomenda de doces é decidida pela foto e pela facilidade de pedir." },
  salao: { key: "salao", label: "salão de beleza", glow: "halo", tagline: "Cabelo, unhas e cuidado", chips: ["Corte e escova", "Coloração", "Mechas", "Hidratação", "Manicure e pedicure"], panelTitle: "Serviços do salão", panelCta: "Agendar horário", offer: "serviços, fotos do ambiente e agendamento pelo WhatsApp", why: "Quem escolhe salão olha trabalhos e ambiente antes de marcar." },
  estetica: { key: "estetica", label: "clínica de estética", glow: "halo", tagline: "Bem-estar com calma", chips: ["Limpeza de pele", "Massagens", "Depilação", "Design de sobrancelhas", "Unhas"], panelTitle: "Tratamentos", panelCta: "Agendar horário", offer: "tratamentos, ambiente e agendamento pelo WhatsApp", why: "Em estética, a confiança vem de ver o ambiente e entender os tratamentos." },
  odonto: { key: "odonto", label: "consultório odontológico", glow: "halo", tagline: "Cuidado com o seu sorriso", chips: ["Avaliação", "Limpeza", "Clareamento", "Ortodontia", "Implantes"], panelTitle: "Atendimento", panelCta: "Agendar avaliação", offer: "tratamentos explicados, fotos do consultório e agendamento de avaliação", why: "Quem procura dentista quer entender os tratamentos e ver o consultório antes de marcar." },
  clinica: { key: "clinica", label: "clínica", glow: "halo", tagline: "Atendimento com atenção", chips: ["Consultas", "Exames", "Retornos", "Acompanhamento"], panelTitle: "Atendimento", panelCta: "Agendar consulta", offer: "especialidades, horários e agendamento de consulta", why: "O paciente procura especialidades, horários e como chegar antes de ligar." },
  academia: { key: "academia", label: "academia", glow: "pulse", tagline: "Treino com orientação", chips: ["Musculação", "Aulas coletivas", "Avaliação física", "Treino orientado"], panelTitle: "Modalidades", panelCta: "Agendar aula experimental", offer: "modalidades, fotos da estrutura e botão para aula experimental", why: "Quem escolhe academia quer ver a estrutura e saber os horários." },
  oficina: { key: "oficina", label: "oficina mecânica", glow: "sparks", tagline: "Diagnóstico claro, serviço bem feito", chips: ["Revisão", "Freios e suspensão", "Troca de óleo", "Diagnóstico", "Orçamento"], panelTitle: "Serviços e orçamento", panelCta: "Pedir orçamento", offer: "serviços, horário ao vivo e pedido de orçamento pelo WhatsApp", why: "Quando o carro dá problema, o cliente quer um contato rápido e saber se a oficina está aberta.", accent: "stripe" },
  roupas: { key: "roupas", label: "loja de roupas", glow: "halo", tagline: "Looks para cada dia", chips: ["Novidades", "Looks", "Acessórios", "Presentes"], panelTitle: "Na vitrine", panelCta: "Chamar no WhatsApp", offer: "vitrine com fotos, horário e contato rápido", why: "Quem compra roupa decide olhando fotos e conferindo se a loja está aberta." },
  pet: { key: "pet", label: "pet shop", glow: "halo", tagline: "Cuidado com quem você ama", chips: ["Banho e tosa", "Ração e acessórios", "Consultas", "Hospedagem"], panelTitle: "Cuidados com o pet", panelCta: "Agendar banho e tosa", offer: "serviços, fotos e agendamento de banho e tosa pelo WhatsApp", why: "O tutor procura serviços e uma forma rápida de agendar." },
  imobiliaria: { key: "imobiliaria", label: "imobiliária", glow: "gold", tagline: "O imóvel certo, com orientação", chips: ["Venda", "Aluguel", "Avaliação de imóvel", "Documentação"], panelTitle: "Imóveis e serviços", panelCta: "Falar com um corretor", offer: "serviços, destaques de imóveis e contato direto com o corretor", why: "Quem busca imóvel pesquisa muito online antes de falar com alguém." },
  otica: { key: "otica", label: "ótica", glow: "halo", tagline: "Ver bem, com estilo", chips: ["Óculos de grau", "Óculos de sol", "Lentes", "Exame de vista"], panelTitle: "Na vitrine", panelCta: "Chamar no WhatsApp", offer: "vitrine de armações, horário e contato rápido", why: "Quem escolhe óculos gosta de ver modelos antes de ir à loja." },
  construcao: { key: "construcao", label: "empresa de construção", glow: "sparks", tagline: "Obra com planejamento", chips: ["Materiais", "Ferramentas", "Obras e reformas", "Orçamento"], panelTitle: "Serviços e orçamento", panelCta: "Pedir orçamento", offer: "serviços, fotos de obras e pedido de orçamento", why: "Quem contrata obra quer ver trabalhos e pedir orçamento com facilidade.", accent: "stripe" },
  generico: { key: "generico", label: "negócio local", glow: "halo", tagline: "Atendimento de confiança", chips: [], panelTitle: "Atendimento", panelCta: "Falar com a gente", offer: "serviços, horário ao vivo e contato rápido", why: "O cliente procura serviços, horário e contato num só lugar." },
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ramo a partir do texto (categoria e nome): usado na abordagem, onde não há conceito visual. */
export function nicheFromText(text: string): Niche {
  const t = fold(text);
  const rules: [RegExp, NicheKey][] = [
    [/barbe|barber/, "barbearia"], [/pizz|forneria/, "pizzaria"], [/hamburg|burger|lanchon/, "hamburgueria"],
    [/cafe|cafeteria|coffee/, "cafe"], [/padaria|panificad|bakery/, "padaria"], [/confeit|doceria|bolo/, "confeitaria"],
    [/restaur|churrasc|bistro|cantina|comida/, "restaurante"], [/salao|cabelei|beleza|hair/, "salao"], [/estetic|spa|depila|manicure/, "estetica"],
    [/odonto|dentist|dental/, "odonto"], [/clinic|medic|consult|saude/, "clinica"], [/academ|crossfit|fitness|gym/, "academia"],
    [/constru|material de const/, "construcao"], [/oficina|mecanic|auto ?center|car repair/, "oficina"], [/roupa|moda|boutique|cloth/, "roupas"],
    [/pet|veterin|animal/, "pet"], [/imobili|corretor|real estate/, "imobiliaria"], [/otica|optic/, "otica"],
  ];
  const hit = rules.find(([r]) => r.test(t))?.[1];
  return NICHES[hit ?? "generico"];
}

/** Ramo do site a partir do objeto do conceito, refinado pelo texto da empresa. */
export function nicheOf(model: ModelKind | undefined, text: string): Niche {
  const byText = nicheFromText(text);
  switch (model) {
    case "pizza": return NICHES.pizzaria;
    case "burger": return NICHES.hamburgueria;
    case "plate": case "cloche": case "cutlery": return byText.key === "pizzaria" || byText.key === "hamburgueria" ? byText : NICHES.restaurante;
    case "cup": case "bean": return NICHES.cafe;
    case "loaf": case "croissant": return NICHES.padaria;
    case "cake": return byText.key === "cafe" || byText.key === "padaria" ? byText : NICHES.confeitaria;
    case "scissors": case "razor": case "pole": return byText.key === "salao" ? NICHES.salao : NICHES.barbearia;
    case "comb": case "hairdryer": return NICHES.salao;
    case "bottle": case "polish": return NICHES.estetica;
    case "tooth": case "implant": return NICHES.odonto;
    case "pill": return NICHES.clinica;
    case "glasses": return NICHES.otica;
    case "dumbbell": case "kettlebell": return NICHES.academia;
    case "wheel": case "wrench": case "gear": return byText.key === "construcao" ? NICHES.construcao : NICHES.oficina;
    case "hanger": case "tshirt": return NICHES.roupas;
    case "bone": case "paw": return NICHES.pet;
    case "key": case "house": return NICHES.imobiliaria;
    default: return byText;
  }
}
