'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AGENTS } from './agents';

/** Um "token" de decisão passa de agente em agente: Scout → Filter → Analyst → Executor → Risk → Logger. */
export default function FlowHero() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => { if (reduce) return; const id = setInterval(() => setI((x) => (x + 1) % AGENTS.length), 1100); return () => clearInterval(id); }, [reduce]);
  const cur = AGENTS[i];
  return (
    <div className="glass relative p-4 sm:p-6" aria-label="Fluxo de decisão dos 6 agentes">
      {/* trilho + token (desktop) */}
      <div className="pointer-events-none absolute left-[8.3%] right-[8.3%] top-[58px] hidden h-px bg-line md:block" />
      <motion.div className="pointer-events-none absolute top-[53px] hidden h-[11px] w-[11px] -translate-x-1/2 rounded-full md:block"
        style={{ background: cur.color, boxShadow: `0 0 18px 4px ${cur.color}88` }}
        animate={{ left: `${((i + 0.5) / AGENTS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 16 }} />
      <ol className="relative grid grid-cols-2 gap-3 md:grid-cols-6">
        {AGENTS.map((a, k) => {
          const on = k === i;
          return (
            <motion.li key={a.id} className="rounded-xl border p-3 text-xs" animate={{ borderColor: on ? a.color : 'rgba(255,255,255,.08)', backgroundColor: on ? a.color + '14' : 'rgba(255,255,255,.02)', y: on ? -3 : 0 }} transition={{ duration: 0.35 }}>
              <div className="font-mono text-[11px]" style={{ color: a.color }}>0{a.n}</div>
              <div className="mt-6 font-semibold uppercase tracking-wider" style={{ color: a.color }}>{a.name}</div>
              <p className="mt-1 text-[11px] leading-snug text-dim">{a.short}</p>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-4 font-mono text-[11px] text-dim" aria-live="off">
        <span style={{ color: cur.color }}>●</span> token de decisão em <span style={{ color: cur.color }}>{cur.name}</span> — {cur.desc}
      </p>
    </div>
  );
}
