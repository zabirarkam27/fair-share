import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function GroupNotFound() {
  return (
    <section className="rounded-xl border bg-card p-8">
      <h1 className="text-2xl font-semibold">This page isn’t available</h1>
      <p className="mt-3 mb-6 text-sm leading-7 text-muted-foreground">
        The record may have been removed, or you may not have access.
      </p>
      <Button asChild>
        <Link href="/dashboard/groups">Back to your groups</Link>
      </Button>
    </section>
  );
}
