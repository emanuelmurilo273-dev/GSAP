"use client";
import { useEffect, useRef } from "react";

/** Inclinação 3D que segue o ponteiro (variáveis --px/--py, de -0.5 a 0.5). Desligada com movimento reduzido ou toque. */
export function useTiltVars<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    el.classList.add("is-live");
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    const leave = () => { el.style.setProperty("--px", "0"); el.style.setProperty("--py", "0"); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); el.classList.remove("is-live"); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); leave(); };
  }, [enabled]);
  return ref;
}
