"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
export function QuickExpense({
  groups,
}: {
  groups: { id: string; name: string }[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a group</DialogTitle>
          <DialogDescription>
            Where does this shared expense belong?
          </DialogDescription>
        </DialogHeader>
        {groups.length ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {groups.map((g) => (
              <li key={g.id}>
                <Button
                  asChild
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3"
                >
                  <Link href={`/dashboard/groups/${g.id}/expenses/new`}>
                    {g.name}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            Create a group first using Create a group, or join one with an
            invitation.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
