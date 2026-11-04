"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-8">
        <h1 className="text-xl font-medium">We couldn’t load this page.</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Please try again. If this keeps happening, check the application’s
          database connection.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
