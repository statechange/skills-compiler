import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-foreground transition hover:opacity-80"
        >
          <span className="inline-flex size-7 items-center justify-center overflow-hidden rounded-md bg-[#0047b4]">
            <Image
              src="/statechange-logo.png"
              alt="State Change"
              width={28}
              height={28}
              className="size-7"
            />
          </span>
          <span className="font-bold tracking-tight">
            State Change <span className="text-muted-foreground">· Skills Compiler</span>
          </span>
        </Link>
        <a
          href="https://statechange.ai"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          statechange.ai ↗
        </a>
      </div>
    </header>
  );
}
