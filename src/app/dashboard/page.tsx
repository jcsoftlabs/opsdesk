import { requireUserOrRedirect } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader user={user} />
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-lg font-semibold text-neutral-900">Tableau de bord</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Bienvenue, {user.fullName}. Les écrans de caisse et de transactions arrivent au jalon M3.
        </p>
      </main>
    </div>
  );
}
