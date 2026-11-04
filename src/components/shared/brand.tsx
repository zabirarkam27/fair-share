import Link from "next/link";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="FairShare home"
      className={cn(
        "inline-flex items-center gap-2.5 text-[26px] font-semibold tracking-[-1.2px]",
        inverted && "text-white",
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-[#c9dda6] text-[#244a33]">
        <Layers className="size-6" strokeWidth={1.7} />
      </span>
      <span>
        fairshare<span className="text-[#8fb774]">.</span>
      </span>
    </Link>
  );
}
