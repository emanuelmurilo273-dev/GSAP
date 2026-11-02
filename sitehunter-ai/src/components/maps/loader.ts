"use client";

// Carregamento único e tolerante a falhas da Maps JavaScript API.
// A chave de navegador é obtida em tempo de execução em /api/maps/config.

export type MapsErrorCode = "not_configured" | "network" | "auth" | "timeout" | "unknown";
export class MapsLoadError extends Error {
  constructor(public code: MapsErrorCode) {
    super(code);
  }
}

export const MAPS_ERROR_TEXT: Record<MapsErrorCode, string> = {
  not_configured: "O mapa ainda não foi configurado pelo administrador (GOOGLE_MAPS_BROWSER_KEY).",
  network: "Não foi possível carregar o Google Maps. Verifique sua conexão ou bloqueadores de conteúdo e tente de novo.",
  auth: "O Google recusou a chave do mapa. O administrador precisa conferir a chave, o faturamento e as restrições de domínio.",
  timeout: "O Google Maps demorou demais para responder. Tente novamente.",
  unknown: "Ocorreu um erro ao carregar o mapa.",
};

export type MapsConfig = { configured: boolean; browserKey: string | null; mapId: string | null; servicesConfigured: boolean };

let configPromise: Promise<MapsConfig> | null = null;
let loadPromise: Promise<typeof google> | null = null;
let authFailed = false;

export function getMapsConfig(): Promise<MapsConfig> {
  configPromise ??= fetch("/api/maps/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { configured: false, browserKey: null, mapId: null, servicesConfigured: false }))
    .catch(() => {
      configPromise = null;
      return { configured: false, browserKey: null, mapId: null, servicesConfigured: false };
    });
  return configPromise;
}

export function onMapsAuthFailure(cb: () => void) {
  const h = () => cb();
  window.addEventListener("sh-maps-auth-failure", h);
  if (authFailed) cb();
  return () => window.removeEventListener("sh-maps-auth-failure", h);
}

export async function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") throw new MapsLoadError("unknown");
  if (authFailed) throw new MapsLoadError("auth");
  if (window.google?.maps?.Map) return window.google;
  if (loadPromise) return loadPromise;
  const cfg = await getMapsConfig();
  if (!cfg.configured || !cfg.browserKey) throw new MapsLoadError("not_configured");
  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const cb = "__shMapsReady";
    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new MapsLoadError("timeout"));
    }, 20_000);
    w[cb] = () => {
      clearTimeout(timer);
      resolve(window.google);
    };
    // Chamado pelo Google quando a chave é inválida ou o domínio não está autorizado.
    w.gm_authFailure = () => {
      authFailed = true;
      window.dispatchEvent(new Event("sh-maps-auth-failure"));
    };
    const params = new URLSearchParams({ key: cfg.browserKey!, v: "weekly", libraries: "marker,geometry", language: "pt-BR", region: "BR", loading: "async", callback: cb });
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      loadPromise = null;
      s.remove();
      reject(new MapsLoadError("network"));
    };
    document.head.append(s);
  });
  return loadPromise;
}
