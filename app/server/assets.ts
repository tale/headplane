import type { ServerBuild } from "react-router";

/** Vite emits relative URLs so imports and CSS also work under any basename. */
export function configureBuild(build: ServerBuild, prefix: string): ServerBuild {
  const assetUrl = (url: string) => `${prefix}/${url.replace(/^\.\//, "").replace(/^\//, "")}`;
  const assets = build.assets;
  const mapAssets = <T extends { module: string; imports?: string[]; css?: string[] }>(
    entry: T,
  ): T => ({
    ...entry,
    module: assetUrl(entry.module),
    imports: entry.imports?.map(assetUrl),
    css: entry.css?.map(assetUrl),
  });
  return {
    ...build,
    basename: prefix,
    publicPath: `${prefix}/`,
    assets: {
      ...assets,
      url: assetUrl(assets.url),
      entry: mapAssets(assets.entry),
      routes: Object.fromEntries(
        Object.entries(assets.routes).map(([id, route]) => {
          if (!route) return [id, route];
          const mapped = mapAssets(route);
          for (const key of [
            "clientActionModule",
            "clientLoaderModule",
            "clientMiddlewareModule",
            "hydrateFallbackModule",
          ] as const) {
            if (route[key]) mapped[key] = assetUrl(route[key]);
          }
          return [id, mapped];
        }),
      ),
    },
  };
}
