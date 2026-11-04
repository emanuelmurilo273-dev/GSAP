// Remonta a cada navegação dentro do painel: dá uma transição curta entre telas.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
