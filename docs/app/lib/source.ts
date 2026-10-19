import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineCollections, defineDocs } from "fumadocs-mdx/macro";

// Pages lead with their own `# Heading`, which doubles as the title when the
// frontmatter doesn't set one.
export const docs = defineDocs({
  dir: ".",
  docs: {
    files: ["**/*.{md,mdx}"],
    async: true,
    schema: ({ path, source }) =>
      pageSchema.extend({
        title: pageSchema.shape.title.default(/^# (.+)$/m.exec(source)?.[1] ?? path),
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

export const changelog = defineCollections({
  type: "doc",
  dir: "..",
  files: ["CHANGELOG.md"],
});
