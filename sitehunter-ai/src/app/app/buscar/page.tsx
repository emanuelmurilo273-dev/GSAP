import { redirect } from "next/navigation";

// A busca agora faz parte do estúdio de leads (descoberta + verificação + oportunidades).
export default function SearchPage() {
  redirect("/app/leads");
}
