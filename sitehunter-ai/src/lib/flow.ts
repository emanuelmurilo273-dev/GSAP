// Google Flow — integração ASSISTIDA.
//
// Verificação (nov/2026): o Google Flow (Google Labs) é uma ferramenta de
// interface disponível nos planos Google AI Pro/Ultra e Workspace; não há
// API pública oficial para desenvolvedores. Os modelos por trás dele (Veo,
// Imagen) têm APIs próprias (Gemini API / Vertex AI), mas isso não é o Flow.
// Wrappers de terceiros que automatizam o Flow não são oficiais e não são usados.
//
// Por isso este módulo NÃO gera imagens: ele prepara um pacote de prompts a
// partir dos fatos confirmados; o usuário gera no Flow, revisa e importa a
// imagem resultante, que fica marcada como "gerada por IA" (origin=generated).
// Se um dia houver API oficial, implemente `FlowProvider.generate` aqui.

export const FLOW_URL = "https://labs.google/fx/tools/flow";

export type FlowPurpose = "hero" | "gallery" | "service" | "ambience";

export type FlowPromptPack = {
  purpose: FlowPurpose;
  prompt: string;
  negative: string;
  aspect: "16:9" | "4:3" | "1:1";
  disclosure: string;
  checklist: string[];
};

const PURPOSE_TEXT: Record<FlowPurpose, string> = {
  hero: "wide hero banner image, generous negative space on the left for headline text",
  gallery: "editorial detail shot, natural light",
  service: "close-up illustrating the service being performed, hands only, no faces",
  ambience: "atmospheric interior mood shot, empty space, no people",
};

/**
 * Monta o prompt. Usa apenas o segmento e o estilo — nunca nome, fachada,
 * logotipo ou pessoas reais, para que a imagem não pareça uma foto real do
 * estabelecimento.
 */
export function buildFlowPrompt(opts: { segmentLabel: string; niche?: string | null; city?: string | null; palette?: { primary: string; accent: string }; purpose: FlowPurpose; style?: string }): FlowPromptPack {
  const subject = opts.niche?.trim() || opts.segmentLabel;
  const palette = opts.palette ? `color palette inspired by ${opts.palette.primary} and ${opts.palette.accent}` : "cohesive modern color palette";
  const prompt = [
    `Illustrative, clearly generic photograph for a small business website in the category "${subject}".`,
    PURPOSE_TEXT[opts.purpose] + ".",
    opts.style ? `Style: ${opts.style}.` : "Style: premium, clean, contemporary, soft cinematic lighting.",
    palette + ".",
    "Generic setting, no recognizable storefront, no signage, no brand names, no logos, no text, no identifiable people.",
  ].join(" ");
  return {
    purpose: opts.purpose,
    prompt,
    negative: "text, watermark, logo, signage, brand names, recognizable faces, real storefront, before-and-after claims, certificates, awards",
    aspect: opts.purpose === "hero" ? "16:9" : opts.purpose === "gallery" ? "4:3" : "1:1",
    disclosure: "Imagem ilustrativa gerada por IA (Google Flow). Não retrata o estabelecimento real.",
    checklist: [
      "A imagem não mostra pessoas identificáveis, logotipos ou fachadas reais.",
      "Não sugere produtos, resultados ou instalações que a empresa não confirmou.",
      "Os termos do Google Flow / plano usado permitem uso comercial da imagem.",
      "A legenda “imagem ilustrativa gerada por IA” ficará visível no site.",
    ],
  };
}
