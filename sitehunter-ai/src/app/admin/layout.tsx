import { Shell } from "@/components/app/Shell";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Shell admin>{children}</Shell>;
}
