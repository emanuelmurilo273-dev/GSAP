import { redirect } from "next/navigation";

// O app abre direto na primeira aba (Buscar empresas).
export default function AppHome() {
  redirect("/app/buscar");
}
