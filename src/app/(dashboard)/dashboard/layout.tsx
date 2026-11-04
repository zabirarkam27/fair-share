import { requireSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSession();
  return (
    <AppShell identity={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  );
}
