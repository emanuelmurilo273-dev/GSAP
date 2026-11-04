import { demoProvider } from "./demo";
import { googlePlacesProvider } from "./googlePlaces";
import { importProvider } from "./csvImport";
import type { BusinessSearchProvider } from "./types";

export const PROVIDERS: BusinessSearchProvider[] = [googlePlacesProvider, importProvider, demoProvider];

export function getProvider(id: string): BusinessSearchProvider {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`provedor desconhecido: ${id}`);
  return p;
}

export function providerStatus() {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, kind: p.kind, configured: p.configured(), setupHint: p.configured() ? "" : p.setupHint }));
}

export type { BusinessSearchProvider, ImportRow } from "./types";
