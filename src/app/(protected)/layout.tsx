import { requireUserOrRedirect } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserOrRedirect();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar user={user} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
