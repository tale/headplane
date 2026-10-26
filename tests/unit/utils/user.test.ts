import { describe, expect, test } from "vitest";

import { USERNAME_PATTERN, validateUsername } from "~/utils/user";

describe("validateUsername", () => {
  test.each(["ab", "john_doe", "user-1.name", "alice@example.com", "josé"])(
    "accepts %s",
    (name) => {
      expect(validateUsername(name)).toBeUndefined();
    },
  );

  // "lm@" is the case from #502: Headscale creates it, but policies strip the
  // trailing "@" so no rule can ever match the user.
  // `ab²`/`abⅫ` are Nl/No, which Go's unicode.IsDigit rejects.
  test.each(["", "a", "1abc", "@abc", "lm@", "a@b@c", "bad name", "bad/name", "ab²", "abⅫ"])(
    "rejects %s",
    (name) => {
      expect(validateUsername(name)).toBeTypeOf("string");
    },
  );
});

describe("USERNAME_PATTERN", () => {
  test("is a valid HTML pattern (unicode sets mode)", () => {
    const regex = new RegExp(`^${USERNAME_PATTERN}$`, "v");
    expect(regex.test("alice@example.com")).toBe(true);
    expect(regex.test("lm@")).toBe(false);
  });
});
