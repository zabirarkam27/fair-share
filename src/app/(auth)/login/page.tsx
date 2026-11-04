import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getSession } from "@/lib/auth/session";
export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
        WELCOME TO FAIRSHARE
      </p>
      <h2 className="text-3xl font-medium tracking-[-1px]">
        Good to have you back.
      </h2>
      <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">
        Sign in to pick up where you left off.
      </p>
      <AuthForm mode="signin" />
    </>
  );
}
