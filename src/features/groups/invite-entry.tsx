"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteTokenSchema } from "./schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function InviteEntry() {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          const url = new URL(value.trim());
          if (url.origin !== window.location.origin || url.search || url.hash)
            throw new Error();
          const match = /^\/join\/([^/]+)$/.exec(url.pathname);
          const token = inviteTokenSchema.parse(match?.[1]);
          router.push(`/join/${token}`);
        } catch {
          setError(
            "Paste a complete FairShare invitation link from this site.",
          );
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="invitation-url">Invitation link</Label>
        <Input
          id="invitation-url"
          type="url"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your invitation link"
          aria-invalid={!!error}
          aria-describedby="invite-help"
          autoComplete="off"
        />
        <p id="invite-help" className="text-xs leading-6 text-muted-foreground">
          Ask the group admin for a link. You’ll review the invitation before
          joining.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit">Continue to invitation</Button>
    </form>
  );
}
