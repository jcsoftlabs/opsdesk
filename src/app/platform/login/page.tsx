import { redirect } from "next/navigation";
import { getCurrentPlatformAdmin } from "@/lib/platformAuth";
import { PlatformLoginForm } from "./PlatformLoginForm";

export default async function PlatformLoginPage() {
  const admin = await getCurrentPlatformAdmin();
  if (admin) redirect("/platform");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <PlatformLoginForm />
    </main>
  );
}
