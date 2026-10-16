import type { IncomingMessage } from "node:http";

import { describe, expect, test } from "vitest";

import { alignOriginScheme } from "../../../runtime/http";

function request(headers: Record<string, string>, encrypted = false) {
  return { headers, socket: encrypted ? { encrypted } : {} } as unknown as IncomingMessage;
}

describe("alignOriginScheme", () => {
  test("rewrites https origin to http behind a TLS-terminating proxy", () => {
    const req = request({ host: "hp.example.com", origin: "https://hp.example.com" });
    alignOriginScheme(req);
    expect(req.headers.origin).toBe("http://hp.example.com");
  });

  test("rewrites http origin to https on a TLS socket", () => {
    const req = request(
      { host: "hp.example.com:3000", origin: "http://hp.example.com:3000" },
      true,
    );
    alignOriginScheme(req);
    expect(req.headers.origin).toBe("https://hp.example.com:3000");
  });

  test("matches hosts case-insensitively", () => {
    const req = request({ host: "HP.example.com", origin: "https://hp.example.com" });
    alignOriginScheme(req);
    expect(req.headers.origin).toBe("http://hp.example.com");
  });

  test("leaves cross-host origins alone", () => {
    const req = request({ host: "hp.example.com", origin: "https://evil.example.com" });
    alignOriginScheme(req);
    expect(req.headers.origin).toBe("https://evil.example.com");
  });

  test("leaves a different port alone", () => {
    const req = request({ host: "hp.example.com:3000", origin: "https://hp.example.com" });
    alignOriginScheme(req);
    expect(req.headers.origin).toBe("https://hp.example.com");
  });

  test("ignores missing, null, and invalid origins", () => {
    for (const origin of [undefined, "null", "not a url"]) {
      const headers: Record<string, string> = { host: "hp.example.com" };
      if (origin) headers.origin = origin;

      const req = request(headers);
      alignOriginScheme(req);
      expect(req.headers.origin).toBe(origin);
    }
  });
});
