import { describe, expect, test } from "vitest";

import { getAuthenticationURL } from "~/routes/ssh/auth-banner";

describe("getAuthenticationURL", () => {
  test("extracts the authentication URL from a Tailscale SSH banner", () => {
    expect(
      getAuthenticationURL(
        "# To authenticate, visit:\nhttps://login.tailscale.com/a/0123456789abcdef\n",
      ),
    ).toBe("https://login.tailscale.com/a/0123456789abcdef");
  });

  test("extracts an HTTP authentication URL from a custom Headscale banner", () => {
    expect(
      getAuthenticationURL(
        "# To authenticate, visit:\nhttp://headscale.internal/auth/0123456789abcdef\n",
      ),
    ).toBe("http://headscale.internal/auth/0123456789abcdef");
  });

  test("rejects banners without a valid HTTP(S) URL", () => {
    expect(getAuthenticationURL("# Authentication required\n")).toBeNull();
    expect(getAuthenticationURL("# To authenticate, visit: https://\n")).toBeNull();
  });
});
