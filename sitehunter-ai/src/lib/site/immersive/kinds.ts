// Modelos 3D procedurais (construídos em three.js no navegador, sem arquivos externos).
export const MODEL_KINDS = [
  "scissors", "razor", "pole", "comb", "hairdryer", "bottle", "polish",
  "tooth", "implant",
  "cup", "bean", "loaf", "croissant", "cake", "plate", "cloche", "cutlery", "pizza", "burger",
  "dumbbell", "kettlebell",
  "wheel", "wrench", "gear",
  "hanger", "tshirt",
  "bone", "paw",
  "key", "house",
  "pill", "glasses",
] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

export const MODEL_LABEL: Record<ModelKind, string> = {
  scissors: "tesoura", razor: "navalha", pole: "poste de barbearia", comb: "pente", hairdryer: "secador", bottle: "frasco", polish: "esmalte",
  tooth: "dente", implant: "implante",
  cup: "xícara de café", bean: "grãos de café", loaf: "pão de fermentação", croissant: "croissant", cake: "bolo", plate: "prato", cloche: "cloche de serviço", cutlery: "talheres", pizza: "pizza", burger: "hambúrguer",
  dumbbell: "halter", kettlebell: "kettlebell",
  wheel: "roda com pneu", wrench: "chave inglesa", gear: "engrenagem",
  hanger: "cabide", tshirt: "camiseta",
  bone: "osso", paw: "patinha",
  key: "chave", house: "casa",
  pill: "cápsula", glasses: "óculos",
};

export const MATERIALS = ["chrome", "gold", "copper", "ceramic", "matte", "pearl", "glass"] as const;
export type Material = (typeof MATERIALS)[number];
export const MATERIAL_LABEL: Record<Material, string> = {
  chrome: "cromo espelhado", gold: "ouro escovado", copper: "cobre", ceramic: "cerâmica clara", matte: "preto fosco", pearl: "perolado", glass: "vidro",
};

export const MOTIFS = ["rings", "particles", "grid", "ribbons"] as const;
export const LAYOUTS = ["left", "right", "center", "editorial"] as const;
export const CHOREOS = ["orbit", "drift", "dive"] as const;

/** Busca de imagens ilustrativas coerente com o objeto do conceito (banco com licença, sempre identificadas). */
export const MODEL_QUERY: Record<ModelKind, string> = {
  scissors: "barbershop haircut", razor: "barber shave", pole: "barbershop interior", comb: "hair salon", hairdryer: "hair salon styling", bottle: "beauty salon products", polish: "manicure nails",
  tooth: "dental clinic", implant: "dentist clinic", cup: "coffee shop espresso", bean: "coffee beans roasting", loaf: "bakery bread", croissant: "bakery pastries", cake: "cake pastry shop",
  plate: "restaurant dish", cloche: "restaurant dining", cutlery: "restaurant table", pizza: "pizza oven", burger: "burger restaurant",
  dumbbell: "gym weights", kettlebell: "gym training", wheel: "car repair workshop", wrench: "auto mechanic", gear: "workshop tools",
  hanger: "clothing boutique", tshirt: "clothing store", bone: "pet shop dog", paw: "dog grooming", key: "house keys real estate", house: "house facade",
  pill: "pharmacy", glasses: "eyeglasses optician",
};

// ---------- Recursos reais (licença livre), servidos em /models ----------
/**
 * Modelos 3D escaneados de objetos reais (fotogrametria, Poly Haven, CC0). Só estes aparecem em 3D:
 * ramo sem modelo escaneado usa fotografia, nunca uma forma 3D simplificada.
 */
export const GLTF_ASSETS: Record<string, { label: string; authors: string; url: string }> = {
  croissant: { label: "Croissant", authors: "Greg Zaal e Dario Barresi", url: "https://polyhaven.com/a/croissant" },
  carrot_cake: { label: "Bolo de cenoura", authors: "Greg Zaal e James Ray Cock", url: "https://polyhaven.com/a/carrot_cake" },
  strawberry_chocolate_cake: { label: "Bolo de chocolate com morangos", authors: "Kuutti Siitonen", url: "https://polyhaven.com/a/strawberry_chocolate_cake" },
  hamburger_buns: { label: "Pães", authors: "Alexander Shulha", url: "https://polyhaven.com/a/hamburger_buns" },
  combination_wrench: { label: "Chave combinada", authors: "BKS", url: "https://polyhaven.com/a/combination_wrench" },
  cross_pein_hammer: { label: "Martelo", authors: "Tics", url: "https://polyhaven.com/a/cross_pein_hammer" },
};

/** Modelo escaneado para cada objeto do conceito (ausente = página com fotografia). */
export function assetForModel(model: string, seed: number, segmentKey?: string): string | null {
  if (segmentKey === "construcao") return "cross_pein_hammer";
  // Concessionária, pneus, lavagem etc.: uma chave inglesa não representa o negócio, então usa fotografia.
  if (segmentKey && ["concessionaria", "autopecas", "pneus", "funilaria", "lavagem", "vistoria"].includes(segmentKey)) return null;
  if (model === "croissant") return "croissant";
  if (model === "cake") return seed % 2 ? "strawberry_chocolate_cake" : "carrot_cake";
  if (model === "loaf") return "hamburger_buns";
  if (model === "wrench" || model === "gear" || model === "wheel") return "combination_wrench";
  return null;
}
