import { ArrowUpRight, Check } from "lucide-react";
import { Brand } from "@/components/shared/brand";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#193e30] px-7 py-7 text-white lg:min-h-screen lg:px-16 lg:py-12">
        <Brand inverted />
        <div className="relative z-10 my-9 lg:my-20">
          <p className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-[#c1d5b0]">
            GOOD COMPANY. CLEAR BALANCES.
          </p>
          <h1 className="text-4xl leading-[1.12] tracking-[-1.7px] sm:text-5xl xl:text-6xl">
            Share the moment.
            <br />
            <span className="font-serif italic text-[#d1dfa9]">
              Split the rest.
            </span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#acc4b1]">
            From everyday groceries to that long-awaited trip. Make room for the
            good things you share.
          </p>
          <div className="mt-9 hidden space-y-3 text-xs text-[#c4d4ba] lg:block">
            <p className="flex items-center gap-2">
              <Check className="size-4" />A home for your shared moments
            </p>
            <p className="flex items-center gap-2">
              <Check className="size-4" />A little clearer, together
            </p>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -bottom-56 size-[520px] rounded-full border border-white/10 shadow-[0_0_0_40px_#ffffff04,0_0_0_80px_#ffffff03]"
        />
        <div className="hidden items-center justify-between border-t border-white/10 pt-6 text-xs text-[#9cb29f] lg:flex">
          <span>Less math. More good company.</span>
          <ArrowUpRight className="size-4" />
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[370px]">{children}</div>
      </section>
    </main>
  );
}
