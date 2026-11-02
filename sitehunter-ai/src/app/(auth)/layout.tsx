import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-[600px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[110px]" />
      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-7">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/termos" className="hover:text-slate-300">Termos de uso</Link> · <Link href="/privacidade" className="hover:text-slate-300">Privacidade</Link>
        </p>
      </div>
    </div>
  );
}
