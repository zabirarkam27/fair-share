import { ShieldCheck, ChevronRight, Layers } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { SignoutButton } from "@/features/auth/signout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { WorkspaceNav } from "./workspace-nav";
type Identity = { name: string; email: string };
function Navigation({
  identity,
  mobile = false,
}: {
  identity: Identity;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-[#193e30] px-6 py-9 text-[#c8d6c4]">
      <Brand inverted />
      <p className="mt-12 mb-4 px-3 text-[9px] font-semibold tracking-[0.2em] text-[#8eac93]">
        YOUR SHARED WORLD
      </p>
      <WorkspaceNav mobile={mobile} />
      <div className="mt-auto pt-10">
        <div className="mb-7 rounded-xl border border-white/10 bg-white/5 p-5">
          <Layers className="mb-5 size-7 text-[#c5dba2]" strokeWidth={1.5} />
          <p className="text-lg leading-6 tracking-tight text-[#e1eace]">
            Less math.
            <br />
            More good company.
          </p>
          <p className="mt-3 text-xs leading-6 text-[#a5bea7]">
            A little clearer, together.
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 pt-6">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dbe7c8] text-sm text-[#3f5d3a]"
            aria-hidden="true"
          >
            {identity.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {identity.name}
            </p>
            <p className="mt-1 truncate text-[10px] text-[#acc1aa]">
              {identity.email}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SignoutButton />
        </div>
      </div>
    </div>
  );
}
export function AppShell({
  identity,
  children,
}: {
  identity: Identity;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-card px-4 py-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] lg:block">
        <Navigation identity={identity} />
      </aside>
      <div className="lg:ml-[238px]">
        <header className="flex h-[72px] items-center justify-between gap-3 border-b bg-card px-5 sm:px-9">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] gap-0 border-none p-0 [&_[data-slot=sheet-close]]:text-white"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>FairShare navigation</SheetTitle>
                  <SheetDescription>
                    Navigate your workspace or sign out.
                  </SheetDescription>
                </SheetHeader>
                <Navigation identity={identity} mobile />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-3 text-xs">
              <span className="hidden text-muted-foreground sm:inline">
                Your workspace
              </span>
              <ChevronRight className="hidden size-3 text-muted-foreground sm:block" />
              <span>Overview</span>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Signed in
          </span>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1400px] px-5 py-8 sm:px-9 sm:py-11"
        >
          {children}
          <footer className="mt-12 flex items-center justify-between border-t pt-6 text-[10px] text-muted-foreground">
            <span className="text-base font-semibold tracking-tight">
              fairshare<span className="text-primary">.</span>
            </span>
            <span>A little clearer, together.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
