import { z } from "zod";
import { SITE_STYLES } from "./styles";
import { OBJECT_KINDS } from "./stage";
import { CHOREOS, LAYOUTS, MATERIALS, MODEL_KINDS, MOTIFS } from "./immersive/kinds";

export const FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Raleway",
  "DM Sans",
  "Nunito",
  "Open Sans",
  "Roboto",
  "Lato",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "Lora",
  "Merriweather",
  "DM Serif Display",
  "Fraunces",
  "Manrope",
  "Archivo",
] as const;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor em formato #RRGGBB");
const text = (max = 600) => z.string().max(max);
const url = z.string().max(2000);

/**
 * Origem de cada imagem (guardada junto com a licença/condição de uso):
 *  stock     → banco de imagens com licença compatível (ex.: Unsplash, com crédito)
 *  company   → imagem da própria empresa; o usuário confirmou ter autorização
 *  generated → gerada por IA (ex.: Google Flow); exibida com aviso "ilustrativa"
 *  user      → enviada/indicada pelo usuário, que declara ter os direitos
 */
export const IMAGE_ORIGINS = ["stock", "company", "generated", "user"] as const;
export type ImageOrigin = (typeof IMAGE_ORIGINS)[number];

export const ImageSchema = z.object({
  url,
  alt: text(200).default(""),
  credit: z.object({ name: text(120), link: url }).optional(),
  origin: z.enum(IMAGE_ORIGINS).optional(),
  license: text(300).optional(),
  sourceUrl: url.optional(),
  generator: text(80).optional(), // ex.: "Google Flow"
});

export const ButtonSchema = z.object({
  label: text(60),
  action: z.enum(["whatsapp", "phone", "link", "section", "maps", "email"]),
  href: text(2000).optional(), // link externo ou id de seção
});

export const ThemeSchema = z.object({
  primary: color,
  accent: color,
  background: color,
  surface: color,
  text: color,
  muted: color,
  headingFont: z.enum(FONTS),
  bodyFont: z.enum(FONTS),
  radius: z.enum(["none", "md", "lg"]),
  /** Direção visual (estrutura e composição). Ausente em sites antigos → derivada do segmento. */
  style: z.enum(SITE_STYLES).optional(),
});

const base = { id: z.string().min(1).max(40), visible: z.boolean().default(true) };

export const SectionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("hero"), title: text(160), subtitle: text(400), image: ImageSchema.optional(), buttons: z.array(ButtonSchema).max(3) }),
  z.object({ ...base, type: z.literal("about"), title: text(120), text: text(2000), image: ImageSchema.optional() }),
  z.object({ ...base, type: z.literal("services"), title: text(120), intro: text(600), items: z.array(z.object({ title: text(100), description: text(400) })).max(24) }),
  z.object({
    ...base,
    type: z.literal("menu"),
    title: text(120),
    intro: text(600),
    categories: z.array(z.object({ name: text(80), items: z.array(z.object({ name: text(100), description: text(300), price: text(30) })).max(40) })).max(12),
  }),
  z.object({ ...base, type: z.literal("products"), title: text(120), intro: text(600), items: z.array(z.object({ name: text(100), description: text(300), image: ImageSchema.optional() })).max(24) }),
  z.object({
    ...base,
    type: z.literal("hours"),
    title: text(120),
    lines: z.array(z.object({ label: text(60), value: text(80) })).max(10),
    note: text(300),
    /** Fuso horário local da empresa (IANA, ex.: America/Manaus): base do "aberto agora". */
    timezone: text(60).optional(),
  }),
  z.object({ ...base, type: z.literal("gallery"), title: text(120), images: z.array(ImageSchema).max(12) }),
  z.object({ ...base, type: z.literal("cta"), title: text(160), text: text(500), button: ButtonSchema }),
  z.object({ ...base, type: z.literal("quote"), title: text(120), text: text(500), buttonLabel: text(60) }),
  z.object({ ...base, type: z.literal("contact"), title: text(120), text: text(500), showMap: z.boolean() }),
  z.object({ ...base, type: z.literal("text"), title: text(120), text: text(3000) }),
  // Destaques em números: só valores confirmados pela empresa. Vazio = seção oculta.
  z.object({
    ...base,
    type: z.literal("stats"),
    title: text(120),
    items: z.array(z.object({ value: text(12), unit: text(12).default(""), label: text(120), source: text(160).default("") })).max(6),
  }),
]);

export const BusinessSchema = z.object({
  name: text(160),
  phone: text(40).default(""),
  whatsapp: text(40).default(""),
  email: text(160).default(""),
  address: text(300).default(""),
  instagram: text(200).default(""),
  mapsUrl: text(2000).default(""),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
});

/** Conceito visual próprio da empresa (Vitrine 3D): identidade, objeto 3D e o porquê de cada escolha. */
export const ConceptSchema = z.object({
  name: text(120),
  summary: text(400),
  reasons: z.array(text(300)).max(14),
  palette: z.object({ bg: color, bg2: color, ink: color, muted: color, accent: color, accent2: color }),
  display: text(40),
  body: text(40),
  caseStyle: z.enum(["upper", "normal"]),
  layout: z.enum(LAYOUTS),
  choreo: z.enum(CHOREOS),
  model: z.enum(MODEL_KINDS),
  material: z.enum(MATERIALS),
  secondary: z.array(z.enum(MODEL_KINDS)).max(3),
  motif: z.enum(MOTIFS),
  heroWord: text(24),
  kicker: text(120),
  highlights: z.array(text(60)).max(3).default([]),
  /** "photo": abertura editorial com foto ampla (referência do site imobiliário); "object": objeto 3D na abertura. */
  heroMode: z.enum(["object", "photo"]).default("object"),
  /** Direção de arte: "noir" (escura, cinematográfica) ou "ivory" (clara, editorial). Decidida pelo ramo. */
  mood: z.enum(["noir", "ivory"]).default("noir"),
  /** Modelo 3D fotogramétrico real (Poly Haven, CC0) que substitui o procedural quando carrega. */
  asset: z.string().max(40).optional(),
  /** Foto real de prato (CC0) usada como superfície do prato/pizza/café em 3D. */
  dish: z.string().max(20).optional(),
  seed: z.number().int().nonnegative(),
  /** Cena 3D do Spline (endereço .splinecode publicado). Opcional: sem ela, o site usa foto em profundidade ou modelo escaneado. */
  spline: z.object({ url: z.string().max(200) }).optional(),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const SiteContentSchema = z.object({
  version: z.literal(1),
  siteName: text(120),
  seo: z.object({ title: text(120), description: text(300) }),
  theme: ThemeSchema,
  business: BusinessSchema,
  sections: z.array(SectionSchema).max(30),
  reviewNotes: z.array(text(300)).max(10).default([]),
  /** Palco 3D ligado à rolagem: objeto do negócio (foto real aprovada ou ilustração em relevo). */
  stage: z
    .object({
      kind: z.enum(OBJECT_KINDS),
      image: ImageSchema.optional(),
      mode: z.enum(["auto", "photo", "illustration", "off"]).default("auto"),
    })
    .optional(),
  concept: ConceptSchema.optional(),
  /** 1 = imagens automáticas já trocadas pelas fotos da biblioteca do app (prévias antigas são atualizadas ao abrir). */
  libraryVersion: z.number().int().optional(),
});

export type SiteContent = z.infer<typeof SiteContentSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];
export type Theme = z.infer<typeof ThemeSchema>;
export type SiteButton = z.infer<typeof ButtonSchema>;
export type SiteImage = z.infer<typeof ImageSchema>;
