import { describe, expect, test } from "vitest";

import {
  asUserReference,
  groupsForUser,
  hasPortSpec,
  isValidGroupName,
  isValidHostName,
  isValidTagName,
  parsePolicy,
  policyDestinations,
  policySources,
  serializePolicy,
  setUserGroups,
  withDefaultPort,
} from "~/utils/acl-policy";

const POLICY = `{
  // Teams that can be referenced from rules
  "groups": {
    "group:eng": ["alice@", "bob@"],
    "group:ops": ["ops@"]
  },
  "tagOwners": {
    "tag:server": ["group:ops"]
  },
  "hosts": {
    "office": "100.64.0.0/24"
  },
  "acls": [
    { "action": "accept", "src": ["group:eng"], "dst": ["tag:server:22"] }
  ],
  "ssh": [
    { "action": "check", "src": ["group:ops"], "dst": ["tag:server"], "users": ["root"], "checkPeriod": "12h" }
  ],
  "autoApprovers": {
    "routes": { "10.0.0.0/8": ["group:ops"] }
  }
}`;

function parseOrThrow(raw: string) {
  const result = parsePolicy(raw);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}

describe("parsePolicy", () => {
  test("parses an empty policy into an empty model", () => {
    const result = parseOrThrow("");
    expect(result.policy).toEqual({
      groups: {},
      tagOwners: {},
      hosts: {},
      acls: [],
      ssh: [],
      extra: {},
    });
    expect(result.hasComments).toBe(false);
  });

  test("parses HuJSON with comments and trailing commas", () => {
    const result = parseOrThrow(`{
      "groups": { "group:eng": ["alice@"], }, // a comment
    }`);

    expect(result.policy.groups).toEqual({ "group:eng": ["alice@"] });
    expect(result.hasComments).toBe(true);
  });

  test("parses every known section", () => {
    const { policy } = parseOrThrow(POLICY);

    expect(policy.groups).toEqual({
      "group:eng": ["alice@", "bob@"],
      "group:ops": ["ops@"],
    });
    expect(policy.tagOwners).toEqual({ "tag:server": ["group:ops"] });
    expect(policy.hosts).toEqual({ office: "100.64.0.0/24" });
    expect(policy.acls).toEqual([{ action: "accept", src: ["group:eng"], dst: ["tag:server:22"] }]);
    expect(policy.ssh).toEqual([
      {
        action: "check",
        src: ["group:ops"],
        dst: ["tag:server"],
        users: ["root"],
        checkPeriod: "12h",
      },
    ]);
  });

  test("keeps unknown top-level keys in extra", () => {
    const { policy } = parseOrThrow(POLICY);
    expect(policy.extra).toEqual({
      autoApprovers: { routes: { "10.0.0.0/8": ["group:ops"] } },
    });
  });

  test("reports invalid JSON instead of throwing", () => {
    const result = parsePolicy("{ not json");
    expect(result.ok).toBe(false);
  });

  test("rejects a policy that is not an object", () => {
    const result = parsePolicy("[]");
    expect(result).toEqual({ ok: false, error: "The policy must be a JSON object" });
  });

  test("tolerates sections with the wrong shape", () => {
    const { policy } = parseOrThrow(`{ "groups": "nope", "acls": { "a": 1 }, "hosts": [] }`);
    expect(policy.groups).toEqual({});
    expect(policy.acls).toEqual([]);
    expect(policy.hosts).toEqual({});
  });
});

describe("serializePolicy", () => {
  test("round-trips a policy without losing data", () => {
    const { policy } = parseOrThrow(POLICY);
    const { policy: again } = parseOrThrow(serializePolicy(policy));
    expect(again).toEqual(policy);
  });

  test("keeps rules on a single line and preserves key order", () => {
    const { policy } = parseOrThrow(POLICY);
    const output = serializePolicy(policy);

    expect(output).toContain(
      `    { "action": "accept", "src": ["group:eng"], "dst": ["tag:server:22"] }`,
    );
    expect(output.indexOf(`"groups"`)).toBeLessThan(output.indexOf(`"tagOwners"`));
    expect(output.endsWith("\n")).toBe(true);
  });

  test("omits empty sections", () => {
    const { policy } = parseOrThrow(`{ "groups": { "group:eng": ["alice@"] } }`);
    const output = serializePolicy(policy);

    expect(output).toContain(`"groups"`);
    expect(output).not.toContain(`"acls"`);
    expect(output).not.toContain(`"hosts"`);
  });

  test("writes unknown keys back out", () => {
    const { policy } = parseOrThrow(POLICY);
    expect(serializePolicy(policy)).toContain(`"autoApprovers"`);
  });
});

describe("group membership", () => {
  test("finds the groups a user belongs to", () => {
    const { policy } = parseOrThrow(POLICY);
    expect(groupsForUser(policy, "alice")).toEqual(["group:eng"]);
    expect(groupsForUser(policy, "ops")).toEqual(["group:ops"]);
    expect(groupsForUser(policy, "nobody")).toEqual([]);
  });

  test("adds a user to a group without reordering the existing members", () => {
    const { policy } = parseOrThrow(POLICY);
    const next = setUserGroups(policy, "ops", ["group:eng", "group:ops"]);

    expect(next.groups["group:eng"]).toEqual(["alice@", "bob@", "ops@"]);
    expect(next.groups["group:ops"]).toEqual(["ops@"]);
  });

  test("removes a user from groups that are no longer selected", () => {
    const { policy } = parseOrThrow(POLICY);
    const next = setUserGroups(policy, "alice", []);

    expect(next.groups["group:eng"]).toEqual(["bob@"]);
  });

  test("creates a group that does not exist yet", () => {
    const { policy } = parseOrThrow(POLICY);
    const next = setUserGroups(policy, "alice", ["group:eng", "group:new"]);

    expect(next.groups["group:new"]).toEqual(["alice@"]);
  });

  test("is a no-op when membership does not change", () => {
    const { policy } = parseOrThrow(POLICY);
    const next = setUserGroups(policy, "alice", ["group:eng"]);

    expect(next.groups).toEqual(policy.groups);
  });
});

describe("catalog helpers", () => {
  test("suggests groups, tags, hosts and users as sources", () => {
    const { policy } = parseOrThrow(POLICY);
    const sources = policySources(policy, ["alice", "ops"]);

    expect(sources).toEqual(
      expect.arrayContaining(["group:eng", "tag:server", "office", "alice@", "ops@"]),
    );
  });

  test("suggests autogroups only where they are valid", () => {
    const { policy } = parseOrThrow(POLICY);

    expect(policySources(policy, [])).toContain("autogroup:member");
    expect(policyDestinations(policy, [])).toContain("autogroup:internet");
    expect(policyDestinations(policy, [])).not.toContain("autogroup:member");
  });

  test("normalizes user references", () => {
    expect(asUserReference("alice")).toBe("alice@");
    expect(asUserReference("alice@")).toBe("alice@");
  });
});

describe("destination ports", () => {
  test("appends :* when no port is given", () => {
    expect(withDefaultPort("tag:web")).toBe("tag:web:*");
    expect(withDefaultPort("group:eng")).toBe("group:eng:*");
    expect(withDefaultPort("autogroup:internet")).toBe("autogroup:internet:*");
    expect(withDefaultPort("alice@")).toBe("alice@:*");
    expect(withDefaultPort("office")).toBe("office:*");
    expect(withDefaultPort("*")).toBe("*:*");
    expect(withDefaultPort("100.64.0.0/24")).toBe("100.64.0.0/24:*");
  });

  test("leaves an existing port spec alone", () => {
    expect(withDefaultPort("tag:web:*")).toBe("tag:web:*");
    expect(withDefaultPort("tag:web:80")).toBe("tag:web:80");
    expect(withDefaultPort("tag:web:80,443")).toBe("tag:web:80,443");
    expect(withDefaultPort("tag:web:8000-8080")).toBe("tag:web:8000-8080");
    expect(withDefaultPort("tag:web:22,8000-8080")).toBe("tag:web:22,8000-8080");
    expect(withDefaultPort("*:*")).toBe("*:*");
  });

  test("treats a bare IPv6 address as unported", () => {
    expect(withDefaultPort("fd7a:115c:a1e0::1")).toBe("fd7a:115c:a1e0::1:*");
    expect(withDefaultPort("[fd7a:115c:a1e0::1]:22")).toBe("[fd7a:115c:a1e0::1]:22");
  });

  test("trims and ignores empty input", () => {
    expect(withDefaultPort("  tag:web  ")).toBe("tag:web:*");
    expect(withDefaultPort("   ")).toBe("");
  });

  test("reports whether a port spec is present", () => {
    expect(hasPortSpec("tag:web:80")).toBe(true);
    expect(hasPortSpec("tag:web")).toBe(false);
    expect(hasPortSpec("fd7a::1")).toBe(false);
  });
});

describe("validation", () => {
  test("accepts well-formed names", () => {
    expect(isValidGroupName("group:eng-team")).toBe(true);
    expect(isValidTagName("tag:web-01")).toBe(true);
    expect(isValidHostName("office-2")).toBe(true);
  });

  test("rejects malformed names", () => {
    expect(isValidGroupName("eng")).toBe(false);
    expect(isValidGroupName("group:")).toBe(false);
    expect(isValidGroupName("group:Eng")).toBe(false);
    expect(isValidTagName("group:eng")).toBe(false);
    expect(isValidHostName("tag:web")).toBe(false);
  });
});
