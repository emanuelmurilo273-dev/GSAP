'use client';
import { ColorType, createChart, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

/** Gráfico de equity (TradingView Lightweight Charts). data: t em milissegundos. */
export default function EquityChart({ data, height = 220, color = '#3ddc84' }: { data: { t: number; v: number }[]; height?: number; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#8392a1', fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,.03)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { vertLine: { color: 'rgba(255,255,255,.2)' }, horzLine: { color: 'rgba(255,255,255,.2)' } },
      handleScroll: false, handleScale: false,
    });
    const s = chart.addAreaSeries({ lineColor: color, topColor: color + '55', bottomColor: color + '00', lineWidth: 2, priceLineVisible: false });
    const seen = new Set<number>();
    const pts = data.map((d) => ({ time: Math.floor(d.t / 1000) as UTCTimestamp, value: d.v })).sort((a, b) => a.time - b.time).filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)));
    s.setData(pts);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => ref.current && chart.applyOptions({ width: ref.current.clientWidth }));
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height, color]);
  if (data.length < 2) return <div className="flex items-center justify-center text-xs text-dim" style={{ height }}>Sem dados suficientes ainda — o gráfico aparece após as primeiras horas de operação.</div>;
  return <div ref={ref} className="w-full" role="img" aria-label="Gráfico de equity" />;
}
