import type { LeadView } from "@/lib/leads/verified";
export type { LeadView };
export type SearchRow = { id: string; provider: string; niche: string; location: string; language: string; requested: number; status: string; isDemo: boolean; found: number; created: number; duplicates: number; error: string | null; startedAt: string; finishedAt: string | null };
export type ProviderRow = { id: "google_places" | "demo" | "import"; label: string; kind: string; configured: boolean; setupHint: string };
