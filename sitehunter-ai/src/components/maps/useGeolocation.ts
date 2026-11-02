"use client";
import { useCallback, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "asking" } // explicação exibida, aguardando o usuário
  | { status: "locating" }
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "error"; message: string };

const MESSAGES: Record<number, string> = {
  1: "Você não permitiu o acesso à localização. Para usar, clique no cadeado ao lado do endereço do site e permita “Localização”, depois tente de novo.",
  2: "Não foi possível descobrir sua localização agora (sinal de GPS ou rede indisponível).",
  3: "A localização demorou demais para responder. Tente novamente.",
};

/** Localização com etapa de explicação antes do pedido de permissão do navegador. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const ask = useCallback(() => setState({ status: "asking" }), []);
  const cancel = useCallback(() => setState({ status: "idle" }), []);
  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", message: "Este navegador não oferece geolocalização." });
      return;
    }
    if (!window.isSecureContext) {
      setState({ status: "error", message: "A localização só funciona em conexões seguras (HTTPS)." });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ status: "ok", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => setState({ status: "error", message: MESSAGES[e.code] ?? "Erro ao obter a localização." }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, []);
  return { state, ask, cancel, locate };
}
