"use client";
import { useEffect } from "react";

/** Fundo ambiente do painel: só CSS (blobs que derivam devagar), sem canvas: não pesa e fica atrás de tudo. */
export function AmbientBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <i className="amb a1" /><i className="amb a2" /><i className="amb a3" />
      <span className="amb-grid" />
    </div>
  );
}

/**
 * Luz que acompanha o mouse nos cartões (.card): um único ouvinte global que só grava duas variáveis CSS
 * (--mx/--my) no cartão sob o ponteiro. Desligado em telas de toque e com "reduzir movimento".
 */
export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last: HTMLElement | null = null, x = 0, y = 0;
    const apply = () => {
      raf = 0;
      if (!last) return;
      const r = last.getBoundingClientRect();
      last.style.setProperty("--mx", `${x - r.left}px`);
      last.style.setProperty("--my", `${y - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".card") as HTMLElement | null;
      if (!el) return;
      last = el; x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => { document.removeEventListener("pointermove", move); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
