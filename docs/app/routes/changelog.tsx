import Header from "@/components/header";
import { useMDXComponents } from "@/components/mdx";
import { changelog } from "@/lib/source";

export function meta() {
  return [
    { title: "Changelog | Headplane" },
    { name: "description", content: "New features and fixes in every Headplane release." },
  ];
}

export default function Changelog() {
  const entry = changelog.get("CHANGELOG.md");
  if (!entry) {
    throw new Error("CHANGELOG.md is missing from the changelog collection");
  }

  const Body = entry.body;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
        <p className="text-muted mt-2 mb-12">New features and fixes in every Headplane release.</p>
        <div>
          <Body components={useMDXComponents()} />
        </div>
      </main>
    </>
  );
}
