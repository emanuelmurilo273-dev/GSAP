import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isPrivateMode } from "@/lib/owner";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");
  return <LoginForm showSignup={!isPrivateMode()} />;
}
