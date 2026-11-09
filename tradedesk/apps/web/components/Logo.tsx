export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'HEXADESK';
const C = ['#4da3ff', '#ffa94d', '#a478ff', '#3ddc84', '#ff5c9a', '#2dd4bf']; // scout, filter, analyst, executor, risk, logger

/** Hexágono com 6 nós (um por agente) ligados ao centro. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const pts = C.map((_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return [16 + 12 * Math.cos(a), 16 + 12 * Math.sin(a)]; });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${APP_NAME} logo`}>
      <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      {pts.map((p, i) => <line key={i} x1="16" y1="16" x2={p[0]} y2={p[1]} stroke={C[i]} strokeOpacity=".5" strokeWidth="1" />)}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill={C[i]} />)}
      <circle cx="16" cy="16" r="2.2" fill="#e6edf3" />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <a href={href} className="flex items-center gap-2.5 no-underline">
      <LogoMark />
      <span className="font-mono text-[15px] font-bold tracking-[0.18em] text-ink">{APP_NAME}</span>
    </a>
  );
}
