import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { inviteTokenSchema } from "@/features/groups/schema";
import { JoinForm } from "@/features/groups/join-form";
import { Brand } from "@/components/shared/brand";
export const metadata: Metadata = {
  title: "Join a group · FairShare",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  const valid = inviteTokenSchema.safeParse(token).success;
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-7 sm:p-10">
        <Brand />
        <h1 className="mt-9 text-3xl font-medium tracking-tight">
          Good things are shared.
        </h1>
        <p className="mt-4 mb-7 text-sm leading-7 text-muted-foreground">
          You’ve been invited to a FairShare group. Accept the invitation to
          meet your people.
        </p>
        {valid ? (
          <JoinForm token={token} signedIn={!!session} />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            This invitation is invalid or no longer available.
          </p>
        )}
      </section>
    </main>
  );
}
