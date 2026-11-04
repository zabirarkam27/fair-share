"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-lg rounded-xl border bg-card p-8"
    >
      <h1 className="text-xl font-semibold">We couldn’t load this view</h1>
      <p className="mt-3 mb-6 text-sm leading-7 text-muted-foreground">
        Your data hasn’t been changed. Try loading this view again.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </section>
  );
}
