'use client';
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/** Número que "conta" até o valor (pt-BR). Respeita prefers-reduced-motion. */
export default function CountUp({ value, decimals = 2, prefix = '', suffix = '', signed = false, duration = 0.9 }: {
  value: number; decimals?: number; prefix?: string; suffix?: string; signed?: boolean; duration?: number;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) { setN(value); return; }
    const c = animate(from.current, value, { duration, ease: 'easeOut', onUpdate: (v) => { from.current = v; setN(v); } });
    return () => c.stop();
  }, [value, duration, reduce]);
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span>{prefix}{signed && n > 0 ? '+' : ''}{s}{suffix}</span>;
}
