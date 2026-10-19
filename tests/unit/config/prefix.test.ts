import { afterEach, expect, test, vi } from "vitest";

import { getPrefix, setServerPrefix } from "~/utils/prefix";

afterEach(() => {
  vi.unstubAllGlobals();
  setServerPrefix("/admin");
});

test("uses the configured server prefix during SSR", () => {
  setServerPrefix("/tools/web");
  expect(getPrefix()).toBe("/tools/web");
});

test("reads the app's HTML configuration before router hydration", () => {
  const querySelector = vi.fn().mockReturnValue({ content: "/tools/web" });
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { querySelector });
  expect(getPrefix()).toBe("/tools/web");
  expect(querySelector).toHaveBeenCalledWith('meta[name="headplane-base-path"]');
});

test("falls back to /admin when HTML configuration is absent", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { querySelector: () => null });
  expect(getPrefix()).toBe("/admin");
});
