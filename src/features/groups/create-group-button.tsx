"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createGroupSchema } from "./schema";
import { createGroup } from "./actions";
export function CreateGroupButton() {
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<
    z.input<typeof createGroupSchema>,
    undefined,
    z.output<typeof createGroupSchema>
  >({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", description: "" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setError("");
          if (value) form.reset();
        }
      }}
    >
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="size-4" />
        Create a group
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start something shared</DialogTitle>
          <DialogDescription>
            A flat, a trip, a dinner club. Give your people a home.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-3 space-y-5"
          onSubmit={form.handleSubmit((values) =>
            startTransition(async () => {
              setError("");
              try {
                const result = await createGroup(values);
                if ("error" in result) setError(result.error);
                else {
                  setOpen(false);
                  router.push("/dashboard/groups/" + result.data.id);
                  router.refresh();
                }
              } catch {
                setError("We could not save right now. Please try again.");
              }
            }),
          )}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              autoComplete="off"
              placeholder="e.g. The Dhanmondi flat"
              maxLength={80}
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={
                form.formState.errors.name ? "group-name-error" : undefined
              }
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p id="group-name-error" className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Input
              id="group-description"
              placeholder="What brings you together?"
              maxLength={240}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create group"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
