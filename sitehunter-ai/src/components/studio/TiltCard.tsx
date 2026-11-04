"use client";
import { useRef } from "react";

/** Cartão com profundidade: inclina levemente seguindo o ponteiro (desligado com reduced-motion via CSS). */
export function TiltCard({ children, className = "", as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "article" }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <Tag
      ref={ref as never}
      className={`tilt ${className}`}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--rx", `${(((e.clientY - r.top) / r.height) - 0.5) * -5}deg`);
        el.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width) - 0.5) * 6}deg`);
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--rx", "0deg");
        ref.current?.style.setProperty("--ry", "0deg");
      }}
    >
      {children}
    </Tag>
  );
}
