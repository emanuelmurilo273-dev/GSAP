import Link from "next/link";
import { isPrivateMode } from "@/lib/owner";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (!isPrivateMode()) return <SignupForm />;
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-white">Cadastro desativado</h1>
      <p className="text-sm text-slate-400">Este painel é de uso privado do proprietário. Não é possível criar contas por aqui.</p>
      <Link href="/login" className="btn-primary">Entrar</Link>
    </div>
  );
}
