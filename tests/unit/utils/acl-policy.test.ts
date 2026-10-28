import { describe, expect, test } from "vitest";

import {
  asUserReference,
  formatPolicy,
  groupsForUser,
  hasPortSpec,
  isValidGroupName,
  isValidHostName,
  isValidRoute,
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
  "grants": [
    { "src": ["group:eng"], "dst": ["tag:server"], "ip": ["tcp:443"] }
  ],
  "autoApprovers": {
    "routes": { "10.0.0.0/8": ["group:ops"] },
    "exitNode": ["tag:exit"]
  },
  "nodeAttrs": [{ "target": ["*"], "attr": ["funnel"] }]
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
      grants: [],
      autoApprovers: { routes: {}, exitNode: [], extra: {} },
      extra: {},
      keyOrder: [],
    });
    expect(result.hasComments).toBe(false);
  });

  test("does not report comments for a policy that only has trailing commas", () => {
    const result = parseOrThrow(`{
      "groups": { "group:eng": ["alice@"], },
    }`);

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
    expect(policy.acls).toEqual([
      { action: "accept", src: ["group:eng"], dst: ["tag:server:22"], extra: {} },
    ]);
    expect(policy.ssh).toEqual([
      {
        action: "check",
        src: ["group:ops"],
        dst: ["tag:server"],
        users: ["root"],
        checkPeriod: "12h",
        extra: {},
      },
    ]);
    expect(policy.grants).toEqual([
      { src: ["group:eng"], dst: ["tag:server"], ip: ["tcp:443"], via: [], extra: {} },
    ]);
    expect(policy.autoApprovers).toEqual({
      routes: { "10.0.0.0/8": ["group:ops"] },
      exitNode: ["tag:exit"],
      extra: {},
    });
  });

  test("reads and writes grant via tags", () => {
    const { policy } = parseOrThrow(`{
      "grants": [{ "src": ["group:eng"], "dst": ["10.0.0.0/8"], "ip": ["*"], "via": ["tag:router"] }]
    }`);

    expect(policy.grants[0].via).toEqual(["tag:router"]);
    expect(policy.grants[0].extra).toEqual({});
    expect(serializePolicy(policy)).toContain(`"via": ["tag:router"]`);
    expect(
      serializePolicy({ ...policy, grants: [{ ...policy.grants[0], via: [] }] }),
    ).not.toContain(`"via"`);
  });

  test("keeps grant app capabilities as they were written", () => {
    const { policy } = parseOrThrow(`{
      "grants": [
        { "src": ["*"], "dst": ["tag:web"], "app": { "example.com/cap/web": [{ "admin": true }] } }
      ]
    }`);

    expect(policy.grants[0].ip).toEqual([]);
    expect(policy.grants[0].extra).toEqual({
      app: { "example.com/cap/web": [{ admin: true }] },
    });
    expect(serializePolicy(policy)).toContain(`"example.com/cap/web"`);
    expect(serializePolicy(policy)).not.toContain(`"ip"`);
  });

  test("keeps rule actions and unknown rule keys as they were written", () => {
    const { policy } = parseOrThrow(`{
      "acls": [
        { "action": "deny", "src": ["group:eng"], "dst": ["tag:server:22"], "srcPosture": ["posture:latest"] }
      ],
      "ssh": [
        { "action": "reject", "src": ["group:ops"], "dst": ["tag:server"], "users": ["root"], "acceptEnv": ["TERM"] }
      ]
    }`);

    expect(policy.acls[0].action).toBe("deny");
    expect(policy.acls[0].extra).toEqual({ srcPosture: ["posture:latest"] });
    expect(policy.ssh[0].action).toBe("reject");
    expect(policy.ssh[0].extra).toEqual({ acceptEnv: ["TERM"] });

    // An action the editor does not know must survive a round trip: rewriting
    // it as "accept" would widen the policy behind the operator's back.
    const serialized = serializePolicy(policy);
    expect(serialized).toContain('"action": "deny"');
    expect(serialized).toContain('"srcPosture": ["posture:latest"]');
    expect(serialized).toContain('"acceptEnv": ["TERM"]');
  });

  test("keeps unknown top-level keys in extra", () => {
    const { policy } = parseOrThrow(POLICY);
    expect(policy.extra).toEqual({
      nodeAttrs: [{ target: ["*"], attr: ["funnel"] }],
    });
  });

  test("reports where invalid JSON goes wrong", () => {
    const result = parsePolicy(`{\n  "acls": [ }`);
    if (result.ok) throw new Error("expected a parse error");

    expect(result.error).toBe("Value expected at line 2, column 13");
    expect(result.diagnostics[0]).toEqual({ from: 14, to: 15, message: "Value expected" });
  });

  test("rejects a policy that is not an object", () => {
    const result = parsePolicy("[]");
    expect(result).toEqual({
      ok: false,
      error: "The policy must be a JSON object",
      diagnostics: [{ from: 0, to: 2, message: "The policy must be a JSON object" }],
    });
  });

  test("tolerates sections with the wrong shape", () => {
    const { policy } = parseOrThrow(`{ "groups": "nope", "acls": { "a": 1 }, "hosts": [] }`);
    expect(policy.groups).toEqual({});
    expect(policy.acls).toEqual([]);
    expect(policy.hosts).toEqual({});
  });

  test("does not treat trailing-comma-like text inside strings as syntax", () => {
    const { policy } = parseOrThrow(`{ "custom": "keep ,} and ,] intact" }`);
    expect(policy.extra.custom).toBe("keep ,} and ,] intact");
  });
});

describe("formatPolicy", () => {
  test("formats HuJSON and keeps comments and trailing commas", () => {
    const result = formatPolicy(
      `{\n"groups":{\n"group:eng":["alice@",],\n},// team\n"acls":[\n]\n}`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toContain("// team");
    expect(result.value).toContain('  "groups": {');
    expect(result.value).toContain('    "group:eng": ["alice@",],');
    expect(result.value.endsWith("\n")).toBe(true);
    expect(parsePolicy(result.value).ok).toBe(true);

    const formattedAgain = formatPolicy(result.value);
    expect(formattedAgain).toEqual(result);
  });

  test("keeps blank lines and inline arrays", () => {
    const result = formatPolicy(
      `{\n"groups": { "group:eng": ["alice@", "bob@"] },\n\n"acls": [\n// engineers\n{ "action": "accept", "src": ["group:eng"], "dst": ["*:*"] },\n\n{ "action": "accept", "src": ["*"], "dst": ["*:22"] },\n],\n}\n`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBe(
      `{\n  "groups": { "group:eng": ["alice@", "bob@"] },\n\n  "acls": [\n    // engineers\n    { "action": "accept", "src": ["group:eng"], "dst": ["*:*"] },\n\n    { "action": "accept", "src": ["*"], "dst": ["*:22"] },\n  ],\n}\n`,
    );
  });

  test("removes padding inside arrays, but not inside strings or comments", () => {
    const result = formatPolicy(`{ "hosts": [ "a [ b ]", [ ] ], /* [ c ] */ "x": [ // d\n1 ] }`);
    expect(result).toEqual({
      ok: true,
      value: `{ "hosts": ["a [ b ]", []], /* [ c ] */ "x": [ // d\n    1] }\n`,
    });
  });

  test("does not format an empty policy", () => {
    expect(formatPolicy("  \n").ok).toBe(false);
  });

  test("does not format invalid input", () => {
    expect(formatPolicy(`{ "groups": [ }`).ok).toBe(false);
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
    expect(serializePolicy(policy)).toContain(`"nodeAttrs"`);
  });

  test("drops auto approvers once both lists are empty", () => {
    const { policy } = parseOrThrow(POLICY);
    const output = serializePolicy({
      ...policy,
      autoApprovers: { routes: {}, exitNode: [], extra: {} },
    });

    expect(output).not.toContain(`"autoApprovers"`);
  });

  test("keeps the original top-level section order", () => {
    const { policy } = parseOrThrow(`{
      "ssh": [{ "action": "accept", "src": ["group:ops"], "dst": ["tag:server"], "users": ["root"] }],
      "hosts": { "office": "100.64.0.0/24" },
      "groups": { "group:eng": ["alice@"] }
    }`);
    const output = serializePolicy(policy);

    expect(output.indexOf(`"ssh"`)).toBeLessThan(output.indexOf(`"hosts"`));
    expect(output.indexOf(`"hosts"`)).toBeLessThan(output.indexOf(`"groups"`));
  });

  test("appends a section that did not exist before", () => {
    const { policy } = parseOrThrow(`{ "hosts": { "office": "100.64.0.0/24" } }`);
    const output = serializePolicy({
      ...policy,
      groups: { "group:eng": ["alice@"] },
    });

    expect(output.indexOf(`"hosts"`)).toBeLessThan(output.indexOf(`"groups"`));
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
    expect(withDefaultPort("fd7a::1")).toBe("fd7a::1:*");
    expect(withDefaultPort("fd7a::/48")).toBe("fd7a::/48:*");
  });

  test("keeps the port of a bracketless IPv6 destination", () => {
    // Headscale splits on the last colon, so this is `fd7a::1` on port 22 and
    // appending `:*` would change which port the rule opens.
    expect(withDefaultPort("fd7a::1:22")).toBe("fd7a::1:22");
    expect(withDefaultPort("fd7a:115c:a1e0::1:80,443")).toBe("fd7a:115c:a1e0::1:80,443");
    expect(hasPortSpec("fd7a::1:22")).toBe(true);
  });

  test("leaves a bracketed IPv6 destination alone", () => {
    expect(withDefaultPort("[fd7a:115c:a1e0::1]:22")).toBe("[fd7a:115c:a1e0::1]:22");
  });

  test("trims and ignores empty input", () => {
    expect(withDefaultPort("  tag:web  ")).toBe("tag:web:*");
    expect(withDefaultPort("   ")).toBe("");
  });

  test("reports whether a port spec is present", () => {
    expect(hasPortSpec("tag:web:80")).toBe(true);
    expect(hasPortSpec("group:eng:*")).toBe(true);
    expect(hasPortSpec("100.64.0.1:22")).toBe(true);
    expect(hasPortSpec("tag:web")).toBe(false);
    expect(hasPortSpec("fd7a::1")).toBe(false);
    expect(hasPortSpec("alice@")).toBe(false);
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

  test("accepts only IP prefixes as routes", () => {
    expect(isValidRoute("10.0.0.0/8")).toBe(true);
    expect(isValidRoute("fd7a:115c:a1e0::/48")).toBe(true);
    expect(isValidRoute("10.0.0.1")).toBe(false);
    expect(isValidRoute("10.0.0.0/33")).toBe(false);
    expect(isValidRoute("tag:router/8")).toBe(false);
    expect(isValidRoute("10.0.0.999/8")).toBe(false);
    expect(isValidRoute("fd7a::/129")).toBe(false);
    expect(isValidRoute("fd7a::/999")).toBe(false);
  });
});
