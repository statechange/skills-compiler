import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BrandHeader } from "@/components/brand-header";
import { AgentationWidget } from "@/components/agentation-widget";
import Image from "next/image";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skills Compiler — make any skill Claude-ready",
  description:
    "A gift from State Change. Paste a GitHub repo or URL and download a ready-to-import .skill.zip for Claude Desktop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gradient-to-b from-[oklch(0.99_0.01_85)] via-[oklch(0.98_0.02_65)] to-[oklch(0.97_0.03_280)]">
        <BrandHeader />
        {children}
        <GiftFooter />
        <Toaster richColors position="top-center" />
        <AgentationWidget />
      </body>
    </html>
  );
}

function GiftFooter() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-10">
      <a
        href="https://statechange.ai"
        target="_blank"
        rel="noreferrer"
        className="mx-auto flex max-w-fit items-center gap-3 rounded-full bg-white/70 px-4 py-2 text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm transition hover:text-foreground"
      >
        <span className="inline-flex size-5 items-center justify-center overflow-hidden rounded bg-[#0047b4]">
          <Image
            src="/statechange-logo.png"
            alt=""
            width={20}
            height={20}
            className="size-5"
            aria-hidden
          />
        </span>
        A gift from <strong className="font-semibold text-foreground">State Change</strong> — mentorship for humans and their AI.
      </a>
    </div>
  );
}
