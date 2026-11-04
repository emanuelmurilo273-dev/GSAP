import { redirect } from "next/navigation";

// Empresas salvas e leads foram unificados no estúdio de leads.
export default function CompaniesPage() {
  redirect("/app/leads");
}
