import type { LeadCriteria, RawBusiness } from "../types";

/**
 * Contrato de um provedor de descoberta de empresas.
 * Provedores devem usar APIs/fontes legítimas, respeitar termos de uso e
 * limites, e nunca contornar login, paywall ou CAPTCHA.
 */
export interface BusinessSearchProvider {
  id: "google_places" | "demo" | "import";
  label: string;
  /** "real" = dados de fonte pública; "demo" = FICTÍCIOS; "import" = fornecidos pelo usuário */
  kind: "real" | "demo" | "import";
  configured(): boolean;
  /** Instruções exibidas quando não está configurado. */
  setupHint: string;
  search(criteria: LeadCriteria, opts?: { rows?: ImportRow[] }): Promise<RawBusiness[]>;
}

export type ImportRow = {
  name: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  sourceUrl?: string;
};
