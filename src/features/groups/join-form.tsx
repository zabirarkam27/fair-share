"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinGroup } from "./actions";
export function JoinForm({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-4">
      {!signedIn && (
        <p className="text-sm leading-6 text-muted-foreground">
          First, sign in or create an account. Return to this invitation to
          join.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {signedIn ? (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError("");
              try {
                const result = await joinGroup({ token });
                if ("error" in result) setError(result.error);
                else {
                  router.push("/dashboard/groups/" + result.data.id);
                  router.refresh();
                }
              } catch {
                setError("Could not accept this invitation. Please try again.");
              }
            })
          }
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Accept invitation
        </Button>
      ) : (
        <Button className="w-full" asChild>
          <Link href={"/login?invite=" + encodeURIComponent(token)}>
            Sign in to continue
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
      <Link
        href="/dashboard"
        className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to your workspace
      </Link>
    </div>
  );
}
