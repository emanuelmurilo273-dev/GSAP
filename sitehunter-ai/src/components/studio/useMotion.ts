"use client";
import { useEffect, useState } from "react";

/**
 * Decide o nível de movimento: "full" (3D + interação), "reduced" (3D estático,
 * sem animação — prefers-reduced-motion) ou "flat" (sem 3D: aparelho modesto,
 * economia de dados). O primeiro render é "reduced" para não piscar no SSR.
 */
export type MotionLevel = "full" | "reduced" | "flat";

export function useMotionLevel(): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>("reduced");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || !!nav.connection?.saveData || !CSS.supports("transform-style", "preserve-3d");
    const compute = () => setLevel(weak ? "flat" : mq.matches ? "reduced" : "full");
    compute();
    mq.addEventListener("change", compute);
    return () => mq.removeEventListener("change", compute);
  }, []);
  return level;
}
