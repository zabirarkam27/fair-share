export function PageHeading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function SuccessNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-6 rounded-xl border border-primary/20 bg-secondary p-4 text-sm text-primary"
    >
      {children}
    </p>
  );
}
