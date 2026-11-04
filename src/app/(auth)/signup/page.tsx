import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getSession } from "@/lib/auth/session";
export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <p className="mb-4 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
        YOUR NEXT SHARED CHAPTER
      </p>
      <h2 className="text-3xl font-medium tracking-[-1px]">
        Good things start here.
      </h2>
      <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">
        Create an account. Make yourself at home.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
