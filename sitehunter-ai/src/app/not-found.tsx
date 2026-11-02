import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-extrabold text-brand-500">404</p>
        <p className="mt-3 text-slate-400">Página não encontrada.</p>
        <Link href="/" className="btn-primary mt-6">Voltar ao início</Link>
      </div>
    </div>
  );
}
