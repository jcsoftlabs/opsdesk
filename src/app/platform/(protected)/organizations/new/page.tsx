import { requirePlatformAdminOrRedirect } from "@/lib/platformAuth";
import { CreateOrganizationForm } from "./CreateOrganizationForm";

export default async function NewOrganizationPage() {
  await requirePlatformAdminOrRedirect();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Nouvelle organisation</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Crée le tenant, son premier bureau, et le premier compte administrateur (mot de passe
          temporaire affiché une seule fois).
        </p>
      </div>
      <CreateOrganizationForm />
    </main>
  );
}
