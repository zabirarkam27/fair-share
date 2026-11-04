"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Trash2, UserMinus, LoaderCircle } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  issueInvite,
  revokeInvite,
  removeMember,
  deleteGroup,
} from "./actions";
import type { GroupDetail } from "./service";

export function GroupControls({ group }: { group: GroupDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [inviteOpen, setInviteOpen] = useState(false),
    [rawLink, setRawLink] = useState(""),
    [expiry, setExpiry] = useState("");
  const [removing, setRemoving] = useState<{
      userId: string;
      name: string;
    } | null>(null),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const isAdmin = group.myRole === "ADMIN";
  function run(
    operation: () => Promise<{ error: string } | { data: unknown }>,
    after?: () => void,
  ) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await operation();
        if ("error" in result) setError(result.error);
        else {
          after?.();
          router.refresh();
        }
      } catch {
        setError("We could not save that change. Please try again.");
      }
    });
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight">Your people</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {group.members.filter((m) => m.status === "ACTIVE").length} active
            members · {isAdmin ? "You’re the group admin." : "You’re a member."}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => {
              setInviteOpen(true);
              setError("");
            }}
          >
            <Link2 className="size-4" />
            Invite friends
          </Button>
        )}
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        {group.members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center gap-3 border-b p-5 last:border-0"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
              {member.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{member.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {member.status === "ACTIVE"
                  ? member.role === "ADMIN"
                    ? "Group admin"
                    : "Member"
                  : "Former member · removed"}
              </p>
            </div>
            {isAdmin &&
              member.status === "ACTIVE" &&
              member.role !== "ADMIN" && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={"Remove " + member.name}
                  onClick={() => {
                    setRemoving(member);
                    setError("");
                  }}
                >
                  <UserMinus className="size-4" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
          <div>
            <h3 className="text-sm font-medium">Group settings</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              You control invitations, membership and this group’s home.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              setDeleting(true);
              setConfirmation("");
              setError("");
            }}
          >
            <Trash2 className="size-4" />
            Delete group
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-primary">
          {notice}
        </p>
      )}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!pending) {
            setInviteOpen(open);
            if (!open) {
              setRawLink("");
              setExpiry("");
              setError("");
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Good company starts here</DialogTitle>
            <DialogDescription>
              Share an invitation to {group.name} with people you trust. Anyone
              with a valid link can sign in and join.
            </DialogDescription>
          </DialogHeader>
          {rawLink ? (
            <div className="space-y-4">
              <Label htmlFor="invite-link">Your invitation link</Label>
              <Input
                id="invite-link"
                readOnly
                value={rawLink}
                onFocus={(e) => e.target.select()}
              />
              <p className="text-xs text-muted-foreground">
                Expires {new Date(expiry).toLocaleDateString("en-GB")}. Save or
                copy this link now; it is shown only here.
              </p>
              <Button
                className="w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(rawLink);
                    setNotice("Invitation copied.");
                  } catch {
                    setNotice("Select and copy the link above.");
                  }
                }}
              >
                <Copy className="size-4" />
                Copy invitation
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">
              {group.invitation?.active
                ? "Creating a new invitation will replace the previous link."
                : "Create a private invitation that expires in seven days."}
            </p>
          )}
          <Button
            disabled={pending}
            variant={rawLink ? "outline" : "default"}
            onClick={() => {
              setError("");
              startTransition(async () => {
                try {
                  const result = await issueInvite({ groupId: group.id });
                  if ("error" in result) setError(result.error);
                  else {
                    setRawLink(
                      window.location.origin + "/join/" + result.data.token,
                    );
                    setExpiry(result.data.expiresAt);
                    router.refresh();
                  }
                } catch {
                  setError("Could not create an invitation. Please try again.");
                }
              });
            }}
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {rawLink || group.invitation?.active
              ? "Replace invitation"
              : "Create invitation"}
          </Button>
          {(group.invitation?.active || rawLink) && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeInvite({ groupId: group.id }),
                  () => {
                    setRawLink("");
                    setExpiry("");
                    setNotice("Invitation revoked.");
                  },
                )
              }
            >
              Revoke invitation
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!pending && !open) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this group. Their membership record
              remains, and existing invitation links will not let them rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Keep member
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (removing)
                  run(
                    () =>
                      removeMember({
                        groupId: group.id,
                        memberId: removing.userId,
                      }),
                    () => {
                      setRemoving(null);
                      setNotice("Member removed.");
                    },
                  );
              }}
            >
              {pending ? "Removing…" : "Remove member"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!pending) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The group will disappear for all members and its invitation will
              stop working. Group history is retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-group-name">
              Type “{group.name}” to confirm
            </Label>
            <Input
              id="delete-group-name"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              maxLength={80}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep group</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || confirmation !== group.name}
              onClick={() =>
                run(
                  () => deleteGroup({ groupId: group.id, confirmation }),
                  () => {
                    setDeleting(false);
                    router.push("/dashboard/groups");
                  },
                )
              }
            >
              {pending ? "Deleting…" : "Delete group"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
