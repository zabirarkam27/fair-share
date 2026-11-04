"use client";
import { useState, useTransition } from "react";
import { LogOut, LoaderCircle } from "lucide-react";
import { signOut } from "./actions";
import { Button } from "@/components/ui/button";
export function SignoutButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-inherit hover:bg-white/10 hover:text-white"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await signOut();
            if ("error" in result) setError(result.error);
          });
        }}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        Sign out
      </Button>
      {error && (
        <p role="alert" className="px-3 text-xs text-[#ffcebd]">
          {error}
        </p>
      )}
    </div>
  );
}
