import type { ServerBuild } from "react-router";
import { describe, expect, test } from "vitest";

import { configureBuild } from "~/server/assets";

const routeFlags = {
  hasAction: false,
  hasLoader: false,
  hasClientAction: false,
  hasClientLoader: false,
  hasClientMiddleware: false,
  hasErrorBoundary: false,
};

function createBuild(): ServerBuild {
  const entry = {
    module: "./assets/entry.js",
    imports: ["assets/shared.js"],
    css: ["/assets/entry.css"],
  };
  return {
    entry: { module: { default: () => new Response() } },
    routes: {},
    basename: "/admin",
    publicPath: "./",
    assetsBuildDirectory: "build/client",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
    assets: {
      version: "test-version",
      url: "./assets/manifest.js",
      entry,
      routes: {
        root: {
          ...routeFlags,
          id: "root",
          module: "./assets/root.js",
          imports: ["./assets/shared.js"],
          css: ["./assets/root.css"],
          clientActionModule: "./assets/action.js",
          clientLoaderModule: "./assets/loader.js",
          clientMiddlewareModule: "./assets/middleware.js",
          hydrateFallbackModule: "./assets/fallback.js",
          hasLoader: true,
        },
        leaf: {
          ...routeFlags,
          id: "leaf",
          parentId: "root",
          module: "./assets/leaf.js",
          clientActionModule: undefined,
          clientLoaderModule: undefined,
          clientMiddlewareModule: undefined,
          hydrateFallbackModule: undefined,
        },
        missing: undefined,
      },
    },
  };
}

describe("runtime asset manifest", () => {
  test("rebases entry and route assets while retaining routing metadata", () => {
    const result = configureBuild(createBuild(), "/tools/web");
    expect(result.basename).toBe("/tools/web");
    expect(result.publicPath).toBe("/tools/web/");
    expect(result.assets).toEqual({
      version: "test-version",
      url: "/tools/web/assets/manifest.js",
      entry: {
        module: "/tools/web/assets/entry.js",
        imports: ["/tools/web/assets/shared.js"],
        css: ["/tools/web/assets/entry.css"],
      },
      routes: {
        root: {
          ...routeFlags,
          id: "root",
          module: "/tools/web/assets/root.js",
          imports: ["/tools/web/assets/shared.js"],
          css: ["/tools/web/assets/root.css"],
          clientActionModule: "/tools/web/assets/action.js",
          clientLoaderModule: "/tools/web/assets/loader.js",
          clientMiddlewareModule: "/tools/web/assets/middleware.js",
          hydrateFallbackModule: "/tools/web/assets/fallback.js",
          hasLoader: true,
        },
        leaf: {
          ...routeFlags,
          id: "leaf",
          parentId: "root",
          module: "/tools/web/assets/leaf.js",
          imports: undefined,
          css: undefined,
          clientActionModule: undefined,
          clientLoaderModule: undefined,
          clientMiddlewareModule: undefined,
          hydrateFallbackModule: undefined,
        },
        missing: undefined,
      },
    });
  });

  test("can configure the same build for different paths without mutating it", () => {
    const build = createBuild();
    const original = structuredClone(build.assets);
    const web = configureBuild(build, "/web");
    const admin = configureBuild(build, "/admin");
    expect(web.assets.routes.root?.module).toBe("/web/assets/root.js");
    expect(admin.assets.routes.root?.module).toBe("/admin/assets/root.js");
    expect(build.assets).toEqual(original);
    expect(build.basename).toBe("/admin");
    expect(build.publicPath).toBe("./");
    expect(web.entry).toBe(build.entry);
    expect(web.routes).toBe(build.routes);
  });
});
