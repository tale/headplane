import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import { use } from "react";

import { useMDXComponents } from "@/components/mdx";
import { baseOptions } from "@/lib/layout";
import { docs, source } from "@/lib/source";

import type { Route } from "./+types/docs";

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params["*"].split("/").filter((slug) => slug.length > 0);
  const page = source.getPage(slugs);
  if (!page) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    path: page.path,
    title: page.data.title,
    description: page.data.description,
    pageTree: await source.serializePageTree(source.getPageTree()),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData.title} | Headplane` },
    { name: "description", content: loaderData.description },
  ];
}

function Content({ path }: { path: string }) {
  const page = docs.getPage(path);
  if (!page) {
    throw new Error(`Unknown page: ${path}`);
  }

  const { toc } = use(page.load());
  const Body = page.body;

  return (
    <DocsPage toc={toc.filter((item) => item.depth > 1)}>
      <DocsBody>
        <Body components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { path, pageTree } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...baseOptions} tree={pageTree}>
      <Content path={path} />
    </DocsLayout>
  );
}
