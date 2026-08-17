import { redirect } from "next/navigation";
import { getCurrentPlatformAdmin } from "@/lib/platformAuth";
import { PlatformChangePasswordForm } from "./PlatformChangePasswordForm";

export default async function PlatformChangePasswordPage() {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) redirect("/platform/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <PlatformChangePasswordForm forced={admin.mustChangePassword} />
    </main>
  );
}
