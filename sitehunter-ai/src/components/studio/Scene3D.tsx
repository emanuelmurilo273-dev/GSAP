"use client";
import { useEffect, useRef } from "react";
import { useMotionLevel } from "./useMotion";

// Composição central: fatos públicos de uma empresa (cartões em profundidade)
// fluem por feixes até uma moldura de site. CSS 3D puro (sem WebGL): leve,
// acessível e com fallback plano. O conteúdo é decorativo (aria-hidden),
// por isso os dados exibidos são genéricos e rotulados como exemplo.

type Props = { compact?: boolean; className?: string };

const CARDS = [
  { k: "Nome", v: "Empresa exemplo", tag: "confirmado", tone: "ok", z: 120, y: 0 },
  { k: "Telefone", v: "(00) 0000-0000", tag: "confirmado", tone: "ok", z: 70, y: 1 },
  { k: "Site", v: "não encontrado", tag: "inferência", tone: "warn", z: 160, y: 2 },
  { k: "Fonte", v: "Google Places · hoje", tag: "fonte", tone: "src", z: 40, y: 3 },
];

export function Scene3D({ compact = false, className = "" }: Props) {
  const level = useMotionLevel();
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (level !== "full" || !root.current || !stage.current) return;
    const el = root.current;
    const st = stage.current;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => { tx = 0; ty = 0; };
    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      st.style.transform = `rotateX(${10 - cy * 7}deg) rotateY(${-16 + cx * 12}deg)`;
      if (visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [level]);

  return (
    <div ref={root} aria-hidden className={`scene3d ${level === "flat" ? "is-flat" : ""} ${level === "full" ? "is-live" : ""} ${compact ? "is-compact" : ""} ${className}`}>
      <div ref={stage} className="scene3d-stage">
        <div className="scene3d-floor" />
        <div className="scene3d-cards">
          {CARDS.map((c, i) => (
            <div key={c.k} className={`scene3d-card tone-${c.tone}`} style={{ "--z": `${c.z}px`, "--i": i } as React.CSSProperties}>
              <span className="scene3d-k">{c.k}</span>
              <span className="scene3d-v">{c.v}</span>
              <span className="scene3d-tag">{c.tag}</span>
            </div>
          ))}
        </div>
        <div className="scene3d-beams">
          {CARDS.map((c, i) => (
            <span key={c.k} className="scene3d-beam" style={{ "--i": i } as React.CSSProperties}><i /></span>
          ))}
        </div>
        <div className="scene3d-site">
          <div className="scene3d-chrome"><b /><b /><b /><span>prévia não publicada</span></div>
          <div className="scene3d-hero">
            <span className="l1" /><span className="l2" /><span className="cta" />
          </div>
          <div className="scene3d-grid"><span /><span /><span /></div>
          <div className="scene3d-row"><span /><span /></div>
        </div>
        <div className="scene3d-chip">Oportunidade · sem site</div>
      </div>
    </div>
  );
}
