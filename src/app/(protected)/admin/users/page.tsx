import { requireRoleOrRedirect } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateUserForm } from "./CreateUserForm";
import { UserRowActions } from "./UserRowActions";

const ROLE_LABEL: Record<string, string> = {
  CASHIER: "Caissier",
  SUPERVISOR: "Superviseur",
  ADMIN: "Administrateur",
};

export default async function AdminUsersPage() {
  await requireRoleOrRedirect(["ADMIN"]);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, username: true, role: true, active: true, createdAt: true },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Utilisateurs</h1>

      <CreateUserForm />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Identifiant</th>
              <th className="px-4 py-2">Rôle</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-900">{user.fullName}</td>
                <td className="px-4 py-2 text-neutral-700">{user.username}</td>
                <td className="px-4 py-2 text-neutral-700">{ROLE_LABEL[user.role]}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      user.active
                        ? "rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                        : "rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600"
                    }
                  >
                    {user.active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <UserRowActions userId={user.id} active={user.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
