import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";

// Pages keep their own `# Heading` (so they read well on GitHub), which
// doubles as the title when the frontmatter doesn't set one.
export const docs = defineDocs({
  dir: ".",
  docs: {
    files: ["**/*.{md,mdx}"],
    async: true,
    schema: ({ path, source }) =>
      pageSchema.extend({
        title: pageSchema.shape.title.default(
          path === "CHANGELOG.md" ? "Changelog" : (/^# (.+)$/m.exec(source)?.[1] ?? path),
        ),
      }),
  },
  meta: {
    files: ["**/meta.json"],
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/",
});
