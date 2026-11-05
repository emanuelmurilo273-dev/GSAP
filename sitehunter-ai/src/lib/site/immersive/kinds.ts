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
