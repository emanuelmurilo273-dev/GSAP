import { z } from "zod";

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
] as const;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "cor em formato #RRGGBB");
const text = (max = 600) => z.string().max(max);
const url = z.string().max(2000);

export const ImageSchema = z.object({
  url,
  alt: text(200).default(""),
  credit: z.object({ name: text(120), link: url }).optional(),
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
});

const base = { id: z.string().min(1).max(40), visible: z.boolean().default(true) };

export const SectionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("hero"), title: text(160), subtitle: text(400), image: ImageSchema.optional(), buttons: z.array(ButtonSchema).max(3) }),
  z.object({ ...base, type: z.literal("about"), title: text(120), text: text(2000), image: ImageSchema.optional() }),
  z.object({ ...base, type: z.literal("services"), title: text(120), intro: text(600), items: z.array(z.object({ title: text(100), description: text(400), icon: text(30).optional(), price: text(30).optional() })).max(24) }),
  z.object({ ...base, type: z.literal("highlights"), title: text(120), items: z.array(z.object({ icon: text(30), title: text(80), text: text(300) })).max(8) }),
  z.object({ ...base, type: z.literal("steps"), title: text(120), intro: text(400), items: z.array(z.object({ title: text(80), text: text(300) })).max(6) }),
  z.object({ ...base, type: z.literal("faq"), title: text(120), items: z.array(z.object({ q: text(200), a: text(800) })).max(10) }),
  z.object({
    ...base,
    type: z.literal("menu"),
    title: text(120),
    intro: text(600),
    categories: z.array(z.object({ name: text(80), items: z.array(z.object({ name: text(100), description: text(300), price: text(30) })).max(40) })).max(12),
  }),
  z.object({ ...base, type: z.literal("products"), title: text(120), intro: text(600), items: z.array(z.object({ name: text(100), description: text(300), image: ImageSchema.optional() })).max(24) }),
  z.object({ ...base, type: z.literal("hours"), title: text(120), lines: z.array(z.object({ label: text(60), value: text(80) })).max(10), note: text(300) }),
  z.object({ ...base, type: z.literal("gallery"), title: text(120), images: z.array(ImageSchema).max(12) }),
  z.object({ ...base, type: z.literal("cta"), title: text(160), text: text(500), button: ButtonSchema }),
  z.object({ ...base, type: z.literal("quote"), title: text(120), text: text(500), buttonLabel: text(60) }),
  z.object({ ...base, type: z.literal("contact"), title: text(120), text: text(500), showMap: z.boolean() }),
  z.object({ ...base, type: z.literal("text"), title: text(120), text: text(3000) }),
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

export const STYLES = ["elegant", "bold", "clean", "industrial", "editorial", "corporate"] as const;

export const SiteContentSchema = z.object({
  version: z.literal(1),
  siteName: text(120),
  style: z.enum(STYLES).default("clean"),
  tagline: text(140).default(""),
  icon: text(30).default("star"),
  marquee: z.array(text(60)).max(10).default([]),
  seo: z.object({ title: text(120), description: text(300) }),
  theme: ThemeSchema,
  business: BusinessSchema,
  sections: z.array(SectionSchema).max(30),
  reviewNotes: z.array(text(300)).max(10).default([]),
});

export type SiteContent = z.infer<typeof SiteContentSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];
export type Theme = z.infer<typeof ThemeSchema>;
export type SiteButton = z.infer<typeof ButtonSchema>;
export type SiteImage = z.infer<typeof ImageSchema>;
