import { Compiler } from "@/components/compiler";

export default function Home() {
  return (
    <main className="flex-1 w-full">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <Compiler />
      </div>
    </main>
  );
}
