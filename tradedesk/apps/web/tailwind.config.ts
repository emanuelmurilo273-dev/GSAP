import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050a07',
        panel: '#08110c',
        line: '#123524',
        dim: '#6b8f7a',
        ink: '#c9f7da',
        neon: { green: '#39ff88', pink: '#ff4fa3', purple: '#a66bff', orange: '#ffa21f', blue: '#3aa8ff' },
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'] },
    },
  },
  plugins: [],
} satisfies Config;
