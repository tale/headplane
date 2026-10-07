import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, test } from "vitest";

import Page, { loader } from "~/routes/settings/overview";
import { headscaleConfigContext, oidcContext } from "~/server/context";

async function renderSettings(hasOidcConfig: boolean, writable: boolean, oidcState: string) {
  const context = {
    get(key: unknown) {
      if (key === headscaleConfigContext) {
        return {
          hasOIDCConfig: () => hasOidcConfig,
          writable: () => writable,
        };
      }
      if (key === oidcContext) {
        return oidcState === "disabled"
          ? { state: "disabled", reason: "OIDC is disabled" }
          : { state: "enabled", value: { status: () => ({ state: oidcState }) } };
      }
      throw new Error("Unexpected context key");
    },
  };

  const loaderData = await loader({ context } as Parameters<typeof loader>[0]);
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { basename: "/admin", initialEntries: ["/admin/settings"] },
      createElement(Page, { loaderData } as ComponentProps<typeof Page>),
    ),
  );
}

describe("Settings authentication restrictions link", () => {
  test.each(["pending", "disabled", "ready"])(
    "is shown with Headscale OIDC when Headplane OIDC is %s",
    async (state) => {
      const html = await renderSettings(true, true, state);

      expect(html).toContain('href="/admin/settings/restrictions"');
    },
  );

  test("is hidden without Headscale OIDC even when Headplane OIDC is ready", async () => {
    const html = await renderSettings(false, true, "ready");

    expect(html).not.toContain('href="/admin/settings/restrictions"');
  });

  test("is hidden when the Headscale configuration is not writable", async () => {
    const html = await renderSettings(true, false, "ready");

    expect(html).not.toContain('href="/admin/settings/restrictions"');
  });
});
