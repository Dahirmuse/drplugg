import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStats } from "@/lib/repo";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?expired=1");

  const stats = await getStats(user.id);

  return (
    <AppShell
      user={{ email: user.email, role: user.role, displayName: user.displayName }}
      streak={stats.streak}
      dueNow={stats.dueNow}
    >
      {children}
    </AppShell>
  );
}
