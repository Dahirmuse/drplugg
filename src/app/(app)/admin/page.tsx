import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-lg font-bold text-plum-dark">Kräver adminbehörighet</h1>
        <p className="mt-1 text-sm text-grey">
          Logga in med administratörens konto för att komma hit.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminPanel adminEmail={user.email} />
    </div>
  );
}
