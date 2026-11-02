"use client";
import { useEffect, useRef, useState } from "react";
import { getMapsConfig, loadGoogleMaps, MAPS_ERROR_TEXT, MapsLoadError, onMapsAuthFailure, type MapsErrorCode } from "./loader";

export type MapPlace = { id: string; name: string; lat: number; lng: number; kind: "none" | "social" | "site"; saved?: boolean };
export type MapPoint = { lat: number; lng: number; label: string; accuracy?: number };

type Props = {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin?: MapPoint | null; // endereço pesquisado ou localização do usuário
  routePolyline?: string | null;
  className?: string;
  ariaLabel?: string;
};

const COLORS = { none: "#3b82f6", social: "#a855f7", site: "#64748b" } as const;

function pinSvg(color: string, selected: boolean, saved?: boolean) {
  const s = selected ? 46 : 36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 23s8-7.2 8-13a8 8 0 1 0-16 0c0 5.8 8 13 8 13Z" fill="${color}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="3.4" fill="#fff"/>${saved ? '<circle cx="18.5" cy="4.5" r="3.5" fill="#22c55e" stroke="#fff" stroke-width="1.2"/>' : ""}</svg>`;
}

type AnyMarker = google.maps.Marker | google.maps.marker.AdvancedMarkerElement;

export function MapView({ places, selectedId, onSelect, origin, routePolyline, className = "", ariaLabel = "Mapa" }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<Map<string, AnyMarker>>(new Map());
  const originMarker = useRef<AnyMarker | null>(null);
  const accuracyCircle = useRef<google.maps.Circle | null>(null);
  const line = useRef<google.maps.Polyline | null>(null);
  const advanced = useRef(false);
  const [state, setState] = useState<"loading" | "ready" | MapsErrorCode>("loading");
  const [attempt, setAttempt] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Carrega a API e cria o mapa
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const off = onMapsAuthFailure(() => setState("auth"));
    (async () => {
      try {
        const [g, cfg] = await Promise.all([loadGoogleMaps(), getMapsConfig()]);
        if (cancelled || !el.current) return;
        advanced.current = !!cfg.mapId && !!g.maps.marker?.AdvancedMarkerElement;
        map.current = new g.maps.Map(el.current, {
          center: { lat: -15.78, lng: -47.93 },
          zoom: 4,
          mapId: cfg.mapId ?? undefined,
          gestureHandling: "cooperative",
          clickableIcons: false,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
        });
        setState("ready");
      } catch (e) {
        if (!cancelled) setState(e instanceof MapsLoadError ? e.code : "unknown");
      }
    })();
    return () => {
      cancelled = true;
      off();
    };
  }, [attempt]);

  const makeMarker = (pos: google.maps.LatLngLiteral, title: string, svg: string, z: number): AnyMarker => {
    if (advanced.current) {
      const img = document.createElement("div");
      img.innerHTML = svg;
      img.style.lineHeight = "0";
      return new google.maps.marker.AdvancedMarkerElement({ map: map.current, position: pos, title, content: img, zIndex: z, gmpClickable: true });
    }
    return new google.maps.Marker({
      map: map.current,
      position: pos,
      title,
      zIndex: z,
      icon: { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), anchor: new google.maps.Point(svg.includes('width="46"') ? 23 : 18, svg.includes('width="46"') ? 46 : 36) },
      optimized: true,
    });
  };
  const removeMarker = (m: AnyMarker) => {
    if ("setMap" in m) m.setMap(null);
    else m.map = null;
  };

  // Marcadores das empresas
  useEffect(() => {
    if (state !== "ready" || !map.current) return;
    markers.current.forEach(removeMarker);
    markers.current.clear();
    const bounds = new google.maps.LatLngBounds();
    for (const p of places) {
      const sel = p.id === selectedId;
      const m = makeMarker({ lat: p.lat, lng: p.lng }, p.name, pinSvg(COLORS[p.kind], sel, p.saved), sel ? 1000 : 10);
      if (advanced.current) (m as google.maps.marker.AdvancedMarkerElement).addListener("gmp-click", () => onSelectRef.current(p.id));
      else (m as google.maps.Marker).addListener("click", () => onSelectRef.current(p.id));
      markers.current.set(p.id, m);
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    if (origin) bounds.extend(origin);
    if (places.length > 1 || (places.length && origin)) map.current.fitBounds(bounds, 56);
    else if (places.length === 1) {
      map.current.setCenter({ lat: places[0]!.lat, lng: places[0]!.lng });
      map.current.setZoom(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, places, selectedId]);

  // Centraliza a empresa selecionada
  useEffect(() => {
    if (state !== "ready" || !map.current || !selectedId) return;
    const p = places.find((x) => x.id === selectedId);
    if (p) map.current.panTo({ lat: p.lat, lng: p.lng });
  }, [state, selectedId, places]);

  // Ponto de origem (endereço pesquisado ou localização do usuário)
  useEffect(() => {
    if (state !== "ready" || !map.current) return;
    if (originMarker.current) removeMarker(originMarker.current);
    accuracyCircle.current?.setMap(null);
    originMarker.current = null;
    if (!origin) return;
    const dot = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#22d3ee" fill-opacity=".25"/><circle cx="13" cy="13" r="6.5" fill="#06b6d4" stroke="#fff" stroke-width="2.5"/></svg>`;
    originMarker.current = makeMarker(origin, origin.label, dot, 2000);
    if (origin.accuracy && origin.accuracy < 5000) {
      accuracyCircle.current = new google.maps.Circle({ map: map.current, center: origin, radius: origin.accuracy, strokeColor: "#06b6d4", strokeOpacity: 0.5, strokeWeight: 1, fillColor: "#22d3ee", fillOpacity: 0.12, clickable: false });
    }
    if (!places.length) {
      map.current.setCenter(origin);
      map.current.setZoom(14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, origin?.lat, origin?.lng, origin?.label]);

  // Rota
  useEffect(() => {
    if (state !== "ready" || !map.current) return;
    line.current?.setMap(null);
    line.current = null;
    if (!routePolyline || !google.maps.geometry?.encoding) return;
    const path = google.maps.geometry.encoding.decodePath(routePolyline);
    line.current = new google.maps.Polyline({ map: map.current, path, strokeColor: "#3b82f6", strokeOpacity: 0.95, strokeWeight: 6, zIndex: 50 });
    const b = new google.maps.LatLngBounds();
    path.forEach((pt) => b.extend(pt));
    map.current.fitBounds(b, 64);
  }, [state, routePolyline]);

  const failed = state !== "loading" && state !== "ready";
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900 ${className}`}>
      <div ref={el} role="region" aria-label={ariaLabel} className="h-full w-full" />
      {state === "loading" && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ink-900" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-r-transparent" aria-hidden />
            Carregando o mapa…
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ink-900 p-6 text-center" role="alert">
          <div className="max-w-sm">
            <p className="text-sm text-slate-300">{MAPS_ERROR_TEXT[state as MapsErrorCode]}</p>
            {state !== "not_configured" && state !== "auth" && (
              <button className="btn-secondary mt-4" onClick={() => setAttempt((a) => a + 1)}>Tentar novamente</button>
            )}
            <p className="mt-3 text-xs text-slate-500">A lista de resultados continua funcionando normalmente.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400" aria-label="Legenda do mapa">
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.none }} />Possivelmente sem site</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.social }} />Só rede social</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.site }} />Site informado</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />Ponto de referência</li>
    </ul>
  );
}
