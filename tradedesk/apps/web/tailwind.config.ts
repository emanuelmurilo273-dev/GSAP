import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05070a',
        panel: '#0a0f14',
        line: '#1b2733',
        dim: '#8392a1',
        ink: '#e6edf3',
        // uma cor por agente, usada em todo o app
        scout: '#4da3ff', filter: '#ffa94d', analyst: '#a478ff', executor: '#3ddc84', risk: '#ff5c9a', logger: '#2dd4bf',
        // aliases (telas antigas): verde=executor, rosa=risk, roxo=analyst, laranja=filter, azul=scout
        neon: { green: '#3ddc84', pink: '#ff5c9a', purple: '#a478ff', orange: '#ffa94d', blue: '#4da3ff', teal: '#2dd4bf' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: { glow: '0 0 0 1px rgba(255,255,255,.04), 0 8px 40px -12px rgba(61,220,132,.25)' },
    },
  },
  plugins: [],
} satisfies Config;
