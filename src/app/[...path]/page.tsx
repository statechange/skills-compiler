import { Compiler } from "@/components/compiler";
import { routeToUrl } from "@/lib/routing";

export default async function SkillRoute({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const initialUrl = routeToUrl(path);

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
        <Compiler initialUrl={initialUrl} />
      </div>
    </main>
  );
}
