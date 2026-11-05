import { randomBytes } from "node:crypto";
import type { ImageCandidate, PresenceReport, RawBusiness } from "./types";

const id = () => randomBytes(6).toString("hex");

/** Imagens encontradas nos canais públicos da empresa: sempre exigem confirmação de autorização. */
export function companyImageCandidates(presence: PresenceReport): ImageCandidate[] {
  return (presence.imageCandidates ?? []).map((c) => ({
    id: id(),
    url: c.url,
    thumb: c.url,
    alt: c.alt,
    origin: "company",
    source: "Site da empresa",
    sourceUrl: c.sourceUrl,
    license: "Direitos da empresa: use somente com autorização dela",
    status: "candidate",
    requiresPermission: true,
  }));
}

/** Imagens que a própria empresa publicou na fonte (ex.: Google Maps, autor = a empresa). Exigem autorização. */
export function sourceImageCandidates(raw: RawBusiness): ImageCandidate[] {
  return (raw.images ?? []).map((c) => ({
    id: id(), url: c.url, thumb: c.url, alt: c.alt, origin: "company", source: c.source, sourceUrl: c.sourceUrl,
    license: "Publicada pela empresa: use somente com autorização dela", status: "candidate", requiresPermission: true, note: c.note ?? null,
  }));
}

export function newImageId() {
  return id();
}
