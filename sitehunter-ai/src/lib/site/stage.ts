import { mix } from "./styles";

// "Palco" 3D ligado à rolagem (inspirado no vídeo de referência): um objeto que representa o
// negócio fica fixo na tela e muda de posição, ângulo e escala a cada etapa, enquanto textos e
// números entram em sequência. O objeto é uma foto real aprovada (painel com espessura) ou uma
// ilustração vetorial em relevo (camadas empilhadas em profundidade). Nada é gerado por IA.

export const OBJECT_KINDS = ["plate", "bread", "scissors", "tooth", "cross", "dumbbell", "wheel", "sneaker", "tshirt", "paw", "house", "hairdryer", "gear"] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const OBJECT_LABEL: Record<ObjectKind, string> = {
  plate: "Prato", bread: "Pão", scissors: "Tesoura", tooth: "Dente", cross: "Cruz da saúde", dumbbell: "Halter", wheel: "Roda",
  sneaker: "Tênis", tshirt: "Camiseta", paw: "Pata", house: "Casa", hairdryer: "Secador", gear: "Engrenagem (serviços)",
};

/** Termo de busca de uma foto do objeto num banco com licença (quando não há foto da empresa). */
export const OBJECT_QUERY: Record<ObjectKind, string> = {
  plate: "plate food dish", bread: "bread loaf", scissors: "barber scissors", tooth: "dentist chair", cross: "stethoscope", dumbbell: "dumbbell",
  wheel: "car wheel", sneaker: "sneaker shoe", tshirt: "clothes hanger shirt", paw: "dog portrait", house: "house exterior", hairdryer: "hair salon", gear: "tools workshop",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolhe o objeto pelo segmento e pela categoria/nome (ex.: loja esportiva → tênis). */
export function objectKindFor(segmentKey: string, text = ""): ObjectKind {
  const t = norm(text);
  if (/esport|sport|tenis|calcad|sapat|running/.test(t)) return "sneaker";
  if (/pizz|restaur|cantina|bistro|lanch|hamburg|comida|bar\b/.test(t)) return "plate";
  if (/padar|panific|confeit|bakery/.test(t)) return "bread";
  if (/barb/.test(t)) return "scissors";
  if (/salao|cabelei|beleza|estetic/.test(t)) return "hairdryer";
  if (/odonto|dent/.test(t)) return "tooth";
  if (/pet|veterin|banho e tosa/.test(t)) return "paw";
  if (/academ|fitness|gym|crossfit/.test(t)) return "dumbbell";
  if (/oficina|mecan|auto|pneu|carro/.test(t)) return "wheel";
  if (/imobil|imove|constru|reforma/.test(t)) return "house";
  if (/roupa|moda|boutique|vestu/.test(t)) return "tshirt";
  if (/clinic|medic|saude|consult/.test(t)) return "cross";
  const bySeg: Record<string, ObjectKind> = {
    restaurante: "plate", padaria: "bread", barbearia: "scissors", salao: "hairdryer", odontologia: "tooth", clinica: "cross", academia: "dumbbell",
    oficina: "wheel", roupas: "tshirt", imobiliaria: "house", petshop: "paw", construcao: "house", servicos: "gear",
  };
  return bySeg[segmentKey] ?? "gear";
}

// ---------- ilustrações (SVG 240×240, cores da marca) ----------
function gearPath(cx: number, cy: number, r1: number, r2: number, teeth: number) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? r2 : r1;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function objectSvg(kind: ObjectKind, p: string, a: string, uid = "o"): string {
  const steel = `<linearGradient id="${uid}st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f8fa"/><stop offset=".5" stop-color="#b9c0c9"/><stop offset="1" stop-color="#6b737e"/></linearGradient>`;
  const brand = `<linearGradient id="${uid}br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(p, "#ffffff", 0.25)}"/><stop offset="1" stop-color="${mix(p, "#000000", 0.35)}"/></linearGradient>`;
  const accent = `<linearGradient id="${uid}ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(a, "#ffffff", 0.2)}"/><stop offset="1" stop-color="${mix(a, "#000000", 0.3)}"/></linearGradient>`;
  const shine = `<linearGradient id="${uid}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const defs = `<defs>${steel}${brand}${accent}${shine}</defs>`;
  const body: Record<ObjectKind, string> = {
    plate: `<radialGradient id="${uid}pl" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".72" stop-color="#eceff3"/><stop offset="1" stop-color="#bcc3cc"/></radialGradient><circle cx="120" cy="120" r="112" fill="url(#${uid}pl)"/><circle cx="120" cy="120" r="78" fill="#f6f7f9" stroke="#d3d8de" stroke-width="3"/><circle cx="120" cy="120" r="112" fill="none" stroke="${p}" stroke-width="5" stroke-opacity=".55"/><ellipse cx="96" cy="86" rx="46" ry="16" fill="#fff" opacity=".7" transform="rotate(-24 96 86)"/>`,
    bread: `<linearGradient id="${uid}bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c27a"/><stop offset=".6" stop-color="#c47a35"/><stop offset="1" stop-color="#7d4318"/></linearGradient><path d="M22 150C22 88 66 56 120 56s98 32 98 94c0 28-22 40-98 40S22 178 22 150Z" fill="url(#${uid}bd)"/><path d="M62 112c18-18 30-20 44-12M100 98c18-18 30-20 44-12M138 90c18-14 28-14 40-6" stroke="#ffe3b3" stroke-width="9" stroke-linecap="round" fill="none" opacity=".85"/><path d="M40 130c40-60 120-66 162-20" stroke="url(#${uid}sh)" stroke-width="14" fill="none" stroke-linecap="round"/>`,
    scissors: `<path d="M98 158 154 26l10 4-44 138Z" fill="url(#${uid}st)"/><path d="M142 158 86 26l-10 4 44 138Z" fill="url(#${uid}st)"/><circle cx="84" cy="184" r="26" fill="none" stroke="url(#${uid}br)" stroke-width="13"/><circle cx="156" cy="184" r="26" fill="none" stroke="url(#${uid}br)" stroke-width="13"/><circle cx="120" cy="104" r="9" fill="${mix(a, "#000000", 0.2)}" stroke="#fff" stroke-width="2"/>`,
    tooth: `<linearGradient id="${uid}to" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e6edf3"/><stop offset="1" stop-color="#aebccb"/></linearGradient><path d="M68 44c22-16 38-2 52-2s30-14 52 2c26 20 16 64 6 92-10 28-10 70-26 74-16 4-16-50-32-50s-16 54-32 50c-16-4-16-46-26-74-10-28-20-72 6-92Z" fill="url(#${uid}to)"/><path d="M84 60c12-6 22 0 30 2" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".9"/><circle cx="182" cy="52" r="10" fill="${a}"/>`,
    cross: `<path d="M92 30h56a10 10 0 0 1 10 10v52h52a10 10 0 0 1 10 10v36a10 10 0 0 1-10 10h-52v52a10 10 0 0 1-10 10H92a10 10 0 0 1-10-10v-52H30a10 10 0 0 1-10-10v-36a10 10 0 0 1 10-10h52V40a10 10 0 0 1 10-10Z" fill="url(#${uid}br)"/><path d="M96 44h40v20H96z" fill="url(#${uid}sh)"/>`,
    dumbbell: `<rect x="58" y="110" width="124" height="20" rx="6" fill="url(#${uid}st)"/><rect x="26" y="70" width="26" height="100" rx="8" fill="url(#${uid}br)"/><rect x="50" y="82" width="16" height="76" rx="6" fill="#23272e"/><rect x="188" y="70" width="26" height="100" rx="8" fill="url(#${uid}br)"/><rect x="174" y="82" width="16" height="76" rx="6" fill="#23272e"/><rect x="30" y="76" width="8" height="40" rx="4" fill="#fff" opacity=".35"/>`,
    wheel: `<circle cx="120" cy="120" r="108" fill="#1c1f24"/><circle cx="120" cy="120" r="108" fill="none" stroke="#2d3239" stroke-width="10" stroke-dasharray="6 9"/><circle cx="120" cy="120" r="70" fill="url(#${uid}st)"/>${[0, 72, 144, 216, 288].map((d) => `<rect x="114" y="56" width="12" height="62" rx="6" fill="#4b525c" transform="rotate(${d} 120 120)"/>`).join("")}<circle cx="120" cy="120" r="18" fill="url(#${uid}br)"/><circle cx="120" cy="120" r="70" fill="none" stroke="${a}" stroke-width="4" opacity=".7"/>`,
    sneaker: `<path d="M18 168h196c10 0 14 18 4 22H30c-14 0-18-16-12-22Z" fill="#f4f5f7"/><path d="M18 168h200v8H18z" fill="#d7dbe0"/><path d="M26 166c2-28 22-46 52-54l40-12c14-4 24-20 40-16l16 26c16 18 40 30 46 56Z" fill="url(#${uid}br)"/><path d="M60 150c40-6 90-28 150 8" stroke="url(#${uid}ac)" stroke-width="10" fill="none" stroke-linecap="round"/>${[0, 1, 2, 3].map((i) => `<path d="M${112 + i * 11} ${110 - i * 3}l14 6" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`).join("")}<path d="M40 140c10-16 26-24 46-28" stroke="url(#${uid}sh)" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    tshirt: `<path d="M82 36 50 52 18 94l32 22 12-16v106h116V100l12 16 32-22-32-42-32-16c-10 22-70 22-76 0Z" fill="url(#${uid}br)"/><path d="M82 36c6 22 66 22 76 0" stroke="${mix(p, "#000000", 0.4)}" stroke-width="6" fill="none"/><path d="M70 110v80" stroke="url(#${uid}sh)" stroke-width="16" stroke-linecap="round"/>`,
    paw: `<ellipse cx="120" cy="152" rx="56" ry="46" fill="url(#${uid}br)"/>${[[58, 96], [96, 64], [144, 64], [182, 96]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="28" fill="url(#${uid}br)"/>`).join("")}<ellipse cx="102" cy="136" rx="20" ry="9" fill="#fff" opacity=".35"/>`,
    house: `<path d="M120 26 18 112h28v100h148V112h28Z" fill="url(#${uid}br)"/><path d="M120 26 18 112h204Z" fill="${mix(p, "#000000", 0.3)}"/><rect x="98" y="146" width="44" height="66" rx="4" fill="url(#${uid}ac)"/><rect x="58" y="128" width="30" height="28" rx="3" fill="#fff" opacity=".85"/><rect x="152" y="128" width="30" height="28" rx="3" fill="#fff" opacity=".85"/>`,
    hairdryer: `<circle cx="104" cy="96" r="62" fill="url(#${uid}br)"/><rect x="150" y="76" width="74" height="40" rx="12" fill="url(#${uid}br)"/><circle cx="104" cy="96" r="30" fill="${mix(p, "#000000", 0.45)}"/><circle cx="104" cy="96" r="12" fill="url(#${uid}st)"/><path d="M90 150h30l-8 74H98Z" fill="url(#${uid}ac)"/><path d="M70 60c14-12 30-16 46-14" stroke="url(#${uid}sh)" stroke-width="10" stroke-linecap="round" fill="none"/>`,
    gear: `<path d="${gearPath(120, 120, 84, 104, 10)}" fill="url(#${uid}st)"/><circle cx="120" cy="120" r="46" fill="url(#${uid}br)"/><circle cx="120" cy="120" r="18" fill="#1c1f24"/><path d="M84 92c10-14 26-20 42-18" stroke="url(#${uid}sh)" stroke-width="9" stroke-linecap="round" fill="none"/>`,
  };
  return `<svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">${defs}${body[kind]}</svg>`;
}

/** Poses do objeto por etapa: [x (vw a partir do centro), y (vh), rotX, rotY, rotZ, escala]. */
export function posesFor(kind: ObjectKind, steps: number): number[][] {
  const lying = kind === "plate" || kind === "wheel" ? 1 : 0; // prato/roda alternam entre frente e "deitado"
  const base = [
    [24, 0, 8 + lying * 44, -24, 0, 1],
    [-24, 2, 16, 30, -6, 0.88],
    [25, -2, 6 + lying * 50, -38, 8, 1.04],
    [-24, 0, 20, 20, 0, 0.94],
    [24, 1, 10 + lying * 40, -18, -4, 1],
  ];
  const out: number[][] = [];
  for (let i = 0; i < steps - 1; i++) out.push(base[i % base.length]!);
  out.push([0, -25, lying * 30, -8, 0, 0.5]); // etapa final: objeto menor, centralizado no alto (texto embaixo)
  return out;
}
