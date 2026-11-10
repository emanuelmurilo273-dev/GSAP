import { ImageResponse } from 'next/og';

export const alt = 'HEXADESK — robô de trading para B3 e cripto';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = [['SCOUT', '#4da3ff'], ['FILTER', '#ffa94d'], ['ANALYST', '#a478ff'], ['EXECUTOR', '#3ddc84'], ['RISK', '#ff5c9a'], ['LOGGER', '#2dd4bf']];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg,#05070a 0%,#0b1220 100%)', color: '#e6edf3', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {C.map(([, c]) => <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}
          <div style={{ marginLeft: 12, fontSize: 30, letterSpacing: 8, color: '#8392a1' }}>HEXADESK</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>Robô para B3</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, color: '#3ddc84' }}>e cripto, 24h.</div>
          <div style={{ fontSize: 28, color: '#8392a1', marginTop: 24 }}>Seu dinheiro na sua conta · stop em toda ordem · sem promessa de lucro</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {C.map(([n, c]) => <div key={n} style={{ border: `2px solid ${c}`, color: c, padding: '8px 16px', borderRadius: 10, fontSize: 22 }}>{n}</div>)}
        </div>
      </div>
    ),
    size,
  );
}
