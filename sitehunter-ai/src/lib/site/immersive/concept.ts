import { MATERIAL_LABEL, MODEL_LABEL, type Material, type ModelKind } from "./kinds";
import type { Concept } from "../types";

// Conceito visual por empresa. Cada escolha sai de um dado pesquisado (nome, ramo, bairro,
// horários publicados, descrição do site oficial, perfis, fotos aprovadas) e é registrada em
// "reasons" para o usuário conferir. Duas empresas do mesmo ramo recebem conceitos diferentes
// porque o nome e os dados mudam a semente e as regras.

export type ConceptInput = {
  name: string;
  category?: string | null;
  segmentKey: string;
  neighborhood?: string | null;
  city?: string | null;
  hoursLines?: { label: string; value: string }[] | null;
  description?: string | null;
  instagram?: string | null;
  hasCompanyPhotos?: boolean;
  hasWhatsapp?: boolean;
  /** Há uma foto ampla utilizável (da empresa ou ilustrativa identificada) para a abertura editorial. */
  hasWidePhoto?: boolean;
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function seedOf(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Cada escolha usa um hash independente (antes, todas dependiam do mesmo resto e coincidiam juntas).
const pick = <T,>(arr: readonly T[], seed: number, salt = 0) => arr[seedOf(`${seed}:${salt}`) % arr.length]!;

// ---------- objeto ----------
type Family = { main: ModelKind[]; secondary: ModelKind[]; why: string };
const RULES: [RegExp, Family][] = [
  [/colonial|confeit|doceria|\bbolo/, { main: ["cake"], secondary: ["cup", "croissant"], why: "o nome indica café colonial ou confeitaria" }],
  [/\b(cafe|coffee|cafeteria|espresso)\b/, { main: ["cup"], secondary: ["bean", "croissant"], why: "o nome/ramo fala de café" }],
  [/pizz|forneria|\bforno\b|napolet/, { main: ["pizza"], secondary: ["cutlery", "plate"], why: "é uma pizzaria (forno a lenha)" }],
  [/burger|hamburg|lanch|smash/, { main: ["burger"], secondary: ["cutlery"], why: "o ramo é lanche/hambúrguer" }],
  [/confeit|doce|bolo|cake|brigad/, { main: ["cake"], secondary: ["cup", "plate"], why: "o ramo é confeitaria" }],
  [/padar|pao|panific|bakery|boulanger/, { main: ["loaf", "croissant"], secondary: ["croissant", "cup", "loaf"], why: "é uma padaria" }],
  [/restaur|bistro|cantina|cozinha|grill|churras|sushi/, { main: ["cloche", "plate"], secondary: ["cutlery", "plate"], why: "é um restaurante" }],
  [/barb/, { main: ["scissors", "razor"], secondary: ["pole", "comb", "razor"], why: "é uma barbearia" }],
  [/manicure|unha|nail|esmalt/, { main: ["polish"], secondary: ["bottle"], why: "o foco é unhas" }],
  [/salao|cabelei|beleza|hair|estetic|studio de beleza/, { main: ["hairdryer", "comb", "bottle"], secondary: ["comb", "bottle", "scissors"], why: "é um salão de beleza" }],
  [/implant/, { main: ["implant"], secondary: ["tooth"], why: "o nome cita implantes" }],
  [/odonto|dent|sorriso|ortodon/, { main: ["tooth"], secondary: ["implant"], why: "é uma clínica odontológica" }],
  [/academ|fitness|crossfit|gym|muscul|treino/, { main: ["dumbbell", "kettlebell"], secondary: ["kettlebell", "dumbbell"], why: "é uma academia" }],
  [/oficina|mecan|auto ?center|pneu|funilar|car repair|automot/, { main: ["wheel"], secondary: ["wrench", "gear"], why: "é uma oficina" }],
  [/roupa|moda|boutique|vestu|brecho|clothes/, { main: ["hanger", "tshirt"], secondary: ["tshirt", "hanger"], why: "é uma loja de roupas" }],
  [/pet|veterin|banho e tosa|canil/, { main: ["bone", "paw"], secondary: ["paw", "bone"], why: "atende pets" }],
  [/imobili|corretor|imovei|real estate/, { main: ["key", "house"], secondary: ["house", "key"], why: "é uma imobiliária" }],
  [/farmac|drogaria/, { main: ["pill"], secondary: ["bottle"], why: "é uma farmácia" }],
  [/otica|optic|oculos/, { main: ["glasses"], secondary: [], why: "é uma ótica" }],
  [/clinic|consult|saude|medic/, { main: ["pill"], secondary: ["bottle"], why: "é uma clínica" }],
];

const TRADES: ModelKind[][] = [["tooth", "implant"], ["cup", "bean", "loaf", "croissant", "cake", "plate", "cloche", "pizza", "burger", "cutlery"], ["hairdryer", "comb", "bottle", "polish"]];
function SAME_TRADE(a: Family, b: Family) { return TRADES.some((t) => t.includes(a.main[0]!) && t.includes(b.main[0]!)) && !(a.main[0] === "cup" || b.main[0] === "cup"); }

/** Objetos com material próprio (comida, tecido, osso): o material da paleta não se aplica. */
const INTRINSIC = new Set<ModelKind>(["loaf", "croissant", "cake", "pizza", "burger", "bean", "bone", "paw", "tshirt", "polish", "pill", "pole", "house", "bottle"]);

const SEGMENT_FALLBACK: Record<string, string> = {
  barbearia: "barb", salao: "salao", restaurante: "restaur", padaria: "padar", odontologia: "odonto", clinica: "clinic", academia: "academ",
  oficina: "oficina", roupas: "roupa", petshop: "pet", imobiliaria: "imobili", construcao: "oficina", servicos: "",
};

// ---------- paletas escuras (fundo, fundo 2, texto, texto suave, destaque, destaque 2) ----------
type Pal = [string, string, string, string, string, string, string];
const PALETTES: Record<string, Pal[]> = {
  warm: [
    ["Âmbar sobre carvão", "#0b0907", "#16110c", "#f6efe6", "#b8a998", "#e2a04a", "#7a4a1d"],
    ["Cobre e fumaça", "#0a0807", "#1a1210", "#f4ece5", "#b5a49a", "#d4774a", "#6b2f1c"],
    ["Mel e noite", "#0c0a06", "#19150c", "#fbf3e2", "#c2b391", "#f0b955", "#5c4214"],
  ],
  cool: [
    ["Gelo e grafite", "#07090c", "#10151b", "#eef3f8", "#9aa8b8", "#7cc4ff", "#2a5a85"],
    ["Menta clínica", "#060a0a", "#0e1716", "#ecf7f5", "#94b3ad", "#5fe0c2", "#1d6b5d"],
    ["Azul profundo", "#05070d", "#0d1222", "#edf1ff", "#97a1c4", "#8aa2ff", "#2b3a8f"],
  ],
  bold: [
    ["Vermelho-sinal", "#090606", "#170c0c", "#f8eeee", "#bfa3a3", "#ff4d3d", "#7a1a12"],
    ["Lima elétrico", "#070806", "#11140d", "#f2f7ea", "#a7b399", "#c6f24e", "#4d6b10"],
    ["Laranja-pista", "#0a0705", "#1a100a", "#fbf0e6", "#c4a891", "#ff7a1a", "#7a330a"],
  ],
  soft: [
    ["Rosa antigo e veludo", "#0b0709", "#1a1015", "#f8eef2", "#c0a6b1", "#f0a6c0", "#7a3550"],
    ["Champanhe e ônix", "#090807", "#171411", "#f7f1e8", "#bcae9c", "#e8c99a", "#7a5e36"],
    ["Lavanda noturna", "#08070c", "#141120", "#f1eefa", "#aaa3c2", "#b9a2ff", "#4b3a8a"],
  ],
  earth: [
    ["Oliva e couro", "#080806", "#13130d", "#f3f1e6", "#aeab96", "#b8c46a", "#5b5a24"],
    ["Terracota", "#0a0706", "#1a0f0b", "#f8ede6", "#c2a597", "#e07b55", "#7a3420"],
  ],
};
const FAMILY_TONE: Record<string, (keyof typeof PALETTES)[]> = {
  cup: ["warm", "earth"], bean: ["warm"], loaf: ["warm", "earth"], croissant: ["warm"], cake: ["soft", "warm"], plate: ["warm", "earth", "soft"], cloche: ["warm", "soft"], pizza: ["bold", "warm"], burger: ["bold", "warm"], cutlery: ["warm"],
  scissors: ["warm", "bold", "cool"], razor: ["warm", "bold"], pole: ["bold"], comb: ["soft"], hairdryer: ["soft", "warm"], bottle: ["soft"], polish: ["soft"],
  tooth: ["cool"], implant: ["cool"], pill: ["cool"], glasses: ["cool", "warm"],
  dumbbell: ["bold", "cool"], kettlebell: ["bold"], wheel: ["bold", "cool"], wrench: ["bold"], gear: ["cool", "bold"],
  hanger: ["soft", "earth"], tshirt: ["soft", "earth"], bone: ["warm", "earth"], paw: ["warm", "soft"], key: ["warm", "cool"], house: ["earth", "cool"],
};

const MATERIAL_FOR: Partial<Record<ModelKind, Material[]>> = {
  scissors: ["chrome", "gold"], razor: ["chrome", "gold", "copper"], comb: ["matte", "pearl", "gold"], hairdryer: ["pearl", "matte", "gold"], bottle: ["glass", "pearl"], polish: ["glass"],
  tooth: ["ceramic", "pearl"], implant: ["chrome"], cup: ["ceramic", "matte", "pearl"], plate: ["ceramic"], cloche: ["chrome", "gold", "copper"], cutlery: ["chrome", "gold"],
  dumbbell: ["matte", "chrome"], kettlebell: ["matte", "copper"], wheel: ["chrome", "matte"], wrench: ["chrome"], gear: ["chrome", "gold", "copper"],
  hanger: ["gold", "matte", "chrome"], key: ["gold", "copper", "chrome"], house: ["ceramic", "matte"], pill: ["pearl", "ceramic"], glasses: ["matte", "gold"],
};

const FONTS: { display: string; body: string; caseStyle: "upper" | "normal"; tone: string }[] = [
  { display: "Syne", body: "Inter", caseStyle: "upper", tone: "geométrica e ousada" },
  { display: "Unbounded", body: "Manrope", caseStyle: "upper", tone: "larga e moderna" },
  { display: "Anton", body: "Inter", caseStyle: "upper", tone: "condensada e forte" },
  { display: "Bricolage Grotesque", body: "Inter", caseStyle: "normal", tone: "grotesca expressiva" },
  { display: "Instrument Serif", body: "Inter", caseStyle: "normal", tone: "serifa editorial fina" },
  { display: "Fraunces", body: "Manrope", caseStyle: "normal", tone: "serifa calorosa" },
  { display: "Cormorant Garamond", body: "Manrope", caseStyle: "normal", tone: "serifa clássica" },
  { display: "Space Grotesk", body: "Space Grotesk", caseStyle: "normal", tone: "técnica e precisa" },
  { display: "Archivo Black", body: "Archivo", caseStyle: "upper", tone: "pesada e direta" },
  { display: "Sora", body: "Sora", caseStyle: "normal", tone: "limpa e contemporânea" },
];
const FONTS_FOR_TONE: Record<string, number[]> = { warm: [3, 4, 5, 6, 0], cool: [7, 9, 1, 3], bold: [2, 0, 8, 1], soft: [4, 6, 5, 9], earth: [5, 3, 6, 7] };

export const CONCEPT_FONTS = [...new Set(FONTS.flatMap((f) => [f.display, f.body]))];

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "the", "and", "ltda", "me", "eireli", "clinica", "studio", "loja", "casa", "barbearia", "salao", "padaria", "restaurante", "odontologia", "academia", "oficina", "cafe", "bar"]);

function heroWord(name: string) {
  const words = name.split(/[\s\-–&·|/]+/).filter(Boolean);
  const good = words.filter((w) => w.length >= 3 && !STOP.has(fold(w)));
  return (good[0] ?? words[0] ?? name).replace(/[^\p{L}\p{N}']/gu, "").toUpperCase().slice(0, 14);
}

function closesLate(lines: { value: string }[]) {
  return lines.some((l) => [...l.value.matchAll(/(\d{1,2}):?(\d{2})?\s*$/g)].some((m) => Number(m[1]) >= 21 || Number(m[1]) <= 2) || /(\d{2}):\d{2}\D+(2[1-3]|0[0-2]):\d{2}/.test(l.value));
}

export function buildConcept(input: ConceptInput): Concept {
  const seed = seedOf(`${input.name}|${input.city ?? ""}|${input.category ?? ""}`);
  const text = fold(`${input.name} ${input.category ?? ""} ${input.description ?? ""}`);
  const reasons: string[] = [];

  // 1. Objeto principal e secundários. O ramo (categoria da fonte / segmento) decide o objeto principal;
  // o nome e a descrição podem trocar a variante (ex.: "Implantes") ou somar um segundo ramo ("Barbershop Cafe").
  const catText = fold(`${input.category ?? ""} ${SEGMENT_FALLBACK[input.segmentKey] ?? ""}`);
  const byCat = RULES.find(([re]) => re.test(catText))?.[1];
  const byName = RULES.find(([re]) => re.test(fold(input.name)))?.[1];
  const byText = RULES.find(([re]) => re.test(text))?.[1];
  // Variante mais específica do mesmo ramo no nome (implante dentro de odontologia, pizzaria dentro de restaurante).
  const specific = byName && byCat && byName !== byCat && SAME_TRADE(byName, byCat) ? byName : null;
  // Nome muito específico (café colonial, forneria, implantes) manda mais que a categoria genérica da fonte.
  const strongName = byName && /colonial|confeit|forneria|pizz|implant/.test(fold(input.name)) ? byName : null;
  const fam: Family = strongName ?? specific ?? byCat ?? byName ?? byText ?? { main: ["gear"], secondary: ["key"], why: "serviço sem objeto típico" };
  const rawModel = pick(fam.main, seed);
  // Restaurante: o prato com foto real é mais fiel ao cardápio que a cloche fechada.
  const model: ModelKind = rawModel === "cloche" ? "plate" : rawModel;
  reasons.push(`Objeto 3D principal: ${MODEL_LABEL[model]}, porque ${fam.why}${fam === byName || specific || strongName ? " (indicado no nome da empresa)" : input.category ? ` (categoria "${input.category}" na fonte)` : ""}.`);
  const secondary: ModelKind[] = [];
  const other = byName && byName !== fam && !SAME_TRADE(byName, fam) ? byName : null;
  if (other) {
    secondary.push(other.main[0]!);
    reasons.push(`Segundo objeto: ${MODEL_LABEL[other.main[0]!]}, porque o nome também indica que ${other.why}.`);
  }
  secondary.push(...fam.secondary);
  const sec = [...new Set(secondary)].filter((k) => k !== model).slice(0, 2);

  // 1b. Realismo: prato com foto real de referência (escolhida pelo cardápio/descrição) ou modelo fotogramétrico.
  let dish: string | undefined, asset: string | undefined;
  if (model === "pizza") dish = "pizza";
  if (model === "cup") dish = "latte";
  if (model === "plate") {
    dish = /ital|massa|pasta|spaghet|espaguet|lasanh|tratt|cantina|nhoque|risot/.test(text) ? "pasta" : /salad|natural|vegan|vegetar|saudav|\bfit\b|poke|bowl/.test(text) ? "salad" : "grill";
  }
  if (model === "croissant") asset = "croissant";
  if (model === "cake") asset = "carrot_cake";
  const dishWhy: Record<string, string> = {
    pizza: "foto real de pizza vista de cima (CC0) como superfície, com borda e relevo em 3D",
    pasta: "foto real de espaguete (CC0), porque o cardápio/descrição indica cozinha italiana",
    salad: "foto real de salada (CC0), porque a descrição indica comida natural ou saudável",
    grill: "foto real de prato com carne grelhada e arroz (CC0), prato típico de restaurante",
    latte: "foto real de café com arte no leite (CC0) na superfície da xícara",
  };
  if (dish) reasons.push(`Realismo: ${dishWhy[dish]}. A foto é ilustrativa, não é prato da empresa.`);
  if (asset) reasons.push("Realismo: modelo 3D fotogramétrico real (Poly Haven, licença CC0), com a versão procedural de reserva enquanto carrega.");

  // 2. Paleta e material
  const tones = FAMILY_TONE[model] ?? ["cool"];
  const tone = pick(tones, seed, 1);
  const pal = pick(PALETTES[tone]!, seed, 2);
  const material = pick(MATERIAL_FOR[model] ?? (["chrome", "gold"] as Material[]), seed, 3);
  const matTxt = INTRINSIC.has(model) ? "" : ` em ${MATERIAL_LABEL[material]}`;
  reasons.push(`Paleta "${pal[0]}"${matTxt ? ` e material ${MATERIAL_LABEL[material]}` : ""}: tom ${tone === "warm" ? "quente" : tone === "cool" ? "frio e limpo" : tone === "bold" ? "de alto contraste" : tone === "soft" ? "suave" : "terroso"} combina com ${MODEL_LABEL[model]}; a variação vem do nome da empresa.`);

  // 3. Tipografia e composição
  const font = FONTS[pick(FONTS_FOR_TONE[tone] ?? [0], seed, 4)]!;
  const layouts = ["left", "right", "center", "editorial"] as const;
  const layout = pick(layouts, seed, 5);
  const choreo = pick(["orbit", "drift", "dive"] as const, seed, 6);
  const motif = pick((tone === "cool" ? ["grid", "particles", "rings"] : tone === "bold" ? ["ribbons", "grid", "particles"] : ["particles", "rings", "ribbons"]) as ("rings" | "particles" | "grid" | "ribbons")[], seed, 7);
  reasons.push(`Tipografia ${font.display} (${font.tone}), texto ${layout === "center" ? "centralizado" : layout === "editorial" ? "em colunas editoriais" : layout === "left" ? "à esquerda" : "à direita"} e movimento "${choreo}".`);

  // 4. Dados da empresa que viram capítulos e textos
  const where = [input.neighborhood, input.city].filter(Boolean).join(" · ");
  const hours = input.hoursLines ?? [];
  const highlights: string[] = [];
  if (where) reasons.push(`Bairro e cidade (${where}) aparecem na abertura.`);
  if (hours.length) {
    if (hours.some((l) => /24 ?h|24 horas/i.test(l.value))) highlights.push("Aberto 24 horas");
    else if (hours.some((l) => /domingo|todos os dias/i.test(l.label) && !/fechado/i.test(l.value))) highlights.push("Abre aos domingos");
    else if (closesLate(hours)) highlights.push("Aberto até mais tarde");
    reasons.push(`Horários publicados viram um capítulo próprio${highlights.length ? ` com o destaque "${highlights[0]}"` : ""}.`);
  }
  if (input.description) reasons.push("O texto “Sobre” parte da descrição publicada no site oficial.");
  if (input.instagram) reasons.push("O perfil do Instagram entra no capítulo final.");
  reasons.push(input.hasCompanyPhotos ? "Fotos da própria empresa (aprovadas) entram no palco e na galeria." : "Sem foto da empresa aprovada: as imagens são ilustrativas e identificadas como tal.");
  if (!input.hasWhatsapp) reasons.push("Sem WhatsApp confirmado: o botão principal liga ou leva ao contato.");

  // Abertura: foto ampla com texto sobreposto (quando há foto boa) ou o objeto 3D. Varia por empresa.
  const heroMode: "object" | "photo" = input.hasCompanyPhotos ? "photo" : input.hasWidePhoto && seed % 2 === 0 ? "photo" : "object";
  reasons.push(heroMode === "photo" ? `Abertura editorial com foto ampla e texto sobreposto${input.hasCompanyPhotos ? " (foto da própria empresa)" : " (imagem ilustrativa identificada)"}; o objeto 3D entra no capítulo seguinte.` : "Abertura com o objeto 3D grande sobre fundo escuro.");
  return {
    name: `${MODEL_LABEL[model][0]!.toUpperCase()}${MODEL_LABEL[model].slice(1)}${matTxt} · ${pal[0]}`,
    summary: `${pal[0]}, tipografia ${font.display} e ${MODEL_LABEL[model]}${matTxt}${sec.length ? `, com ${sec.map((k) => MODEL_LABEL[k]).join(" e ")} entrando ao rolar` : ""}.`,
    reasons,
    palette: { bg: pal[1], bg2: pal[2], ink: pal[3], muted: pal[4], accent: pal[5], accent2: pal[6] },
    display: font.display,
    body: font.body,
    caseStyle: font.caseStyle,
    layout,
    choreo,
    model,
    material,
    secondary: sec,
    motif,
    heroWord: heroWord(input.name),
    kicker: where || (input.category ?? ""),
    highlights,
    seed,
    heroMode,
    ...(dish ? { dish } : {}),
    ...(asset ? { asset } : {}),
  };
}

/** Outra variação visual do mesmo conceito (mesmo objeto e dados): troca paleta, fontes, composição e movimento. */
export function varyConcept(c: Concept): Concept {
  const seed = (c.seed * 1103515245 + 12345) >>> 0;
  const tones = FAMILY_TONE[c.model] ?? ["cool"];
  const tone = pick(tones, seed, 1);
  const pal = pick(PALETTES[tone]!, seed, 2);
  const font = FONTS[pick(FONTS_FOR_TONE[tone] ?? [0], seed, 4)]!;
  const material = INTRINSIC.has(c.model) ? c.material : pick(MATERIAL_FOR[c.model] ?? (["chrome", "gold"] as Material[]), seed, 3);
  const matTxt = INTRINSIC.has(c.model) ? "" : ` em ${MATERIAL_LABEL[material]}`;
  return {
    ...c,
    seed,
    palette: { bg: pal[1], bg2: pal[2], ink: pal[3], muted: pal[4], accent: pal[5], accent2: pal[6] },
    display: font.display,
    body: font.body,
    caseStyle: font.caseStyle,
    material,
    layout: pick(["left", "right", "center", "editorial"] as const, seed, 5),
    choreo: pick(["orbit", "drift", "dive"] as const, seed, 6),
    motif: pick(["particles", "rings", "grid", "ribbons"] as const, seed, 7),
    name: `${MODEL_LABEL[c.model][0]!.toUpperCase()}${MODEL_LABEL[c.model].slice(1)}${matTxt} · ${pal[0]}`,
    summary: `${pal[0]}, tipografia ${font.display} e ${MODEL_LABEL[c.model]}${matTxt}${c.secondary.length ? `, com ${c.secondary.map((k) => MODEL_LABEL[k]).join(" e ")} entrando ao rolar` : ""}.`,
    reasons: [...c.reasons.filter((r) => !r.startsWith("Variação")), "Variação de paleta, tipografia e movimento escolhida no editor."].slice(0, 14),
  };
}

export function relabelModel(c: Concept, model: ModelKind): Concept {
  const matTxt = INTRINSIC.has(model) ? "" : ` em ${MATERIAL_LABEL[c.material]}`;
  const dish = model === "pizza" ? "pizza" : model === "cup" ? "latte" : model === "plate" ? (c.dish && c.dish !== "pizza" && c.dish !== "latte" ? c.dish : "grill") : undefined;
  const asset = model === "croissant" ? "croissant" : model === "cake" ? "carrot_cake" : undefined;
  return { ...c, model, dish, asset, secondary: c.secondary.filter((k) => k !== model), name: `${MODEL_LABEL[model][0]!.toUpperCase()}${MODEL_LABEL[model].slice(1)}${matTxt} · ${c.name.split(" · ")[1] ?? ""}`, reasons: [...c.reasons.filter((r) => !r.startsWith("Objeto trocado")), `Objeto trocado no editor para ${MODEL_LABEL[model]}.`].slice(0, 14) };
}
