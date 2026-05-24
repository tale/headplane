import { describe, expect, test } from "vitest";

import {
  type AclPolicy,
  type AclRule,
  type SshRule,
  addAclRule,
  addSshRule,
  parsePolicy,
  removeAclRule,
  removeGroup,
  removeHost,
  removeSshRule,
  removeTagOwner,
  setGroup,
  setHost,
  setTagOwner,
  stringifyPolicy,
  updateAclRule,
  updateSshRule,
} from "~/utils/acl-editor";

const FULL = `{
  "acls": [
    {"action": "accept", "src": ["group:admin"], "dst": ["*:*"]},
    {"action": "accept", "src": ["group:dev"], "dst": ["tag:server:22"]}
  ],
  "groups": {
    "group:admin": ["user1", "user2"],
    "group:dev": ["user3"]
  },
  "hosts": {
    "server1": "100.64.0.1",
    "server2": "100.64.0.2"
  },
  "tagOwners": {
    "tag:server": ["group:admin"],
    "tag:ci": ["user3"]
  },
  "ssh": [
    {"action": "accept", "src": ["group:admin"], "dst": ["tag:server"], "users": ["root"]}
  ]
}`;

const WITH_COMMENTS = `{
  // Main access rules
  "acls": [
    // Allow admins everywhere
    {"action": "accept", "src": ["group:admin"], "dst": ["*:*"]},
  ],
  // Team groups
  "groups": {
    "group:admin": ["alice", "bob"],
  },
}`;

const WITH_EXTRA_FIELDS = `{
  "acls": [
    {"action": "accept", "src": ["*"], "dst": ["*:*"]}
  ],
  "autoApprovers": {
    "routes": {"10.0.0.0/8": ["group:admin"]},
    "exitNode": ["group:admin"]
  },
  "tests": [
    {"src": "user1", "accept": ["100.64.0.1:80"]}
  ]
}`;

const rule = (o?: Partial<AclRule>): AclRule => ({
  action: "accept",
  src: ["*"],
  dst: ["*:*"],
  ...o,
});

const ssh = (o?: Partial<SshRule>): SshRule => ({
  action: "accept",
  src: ["group:admin"],
  dst: ["tag:server"],
  users: ["root"],
  ...o,
});

describe("parsing", () => {
  test("empty/whitespace input returns empty object", () => {
    expect(parsePolicy("")).toEqual({});
    expect(parsePolicy("  ")).toEqual({});
  });

  test("parses all policy sections", () => {
    const p = parsePolicy(FULL);
    expect(p.acls).toHaveLength(2);
    expect(Object.keys(p.groups ?? {})).toEqual(["group:admin", "group:dev"]);
    expect(Object.keys(p.hosts ?? {})).toEqual(["server1", "server2"]);
    expect(Object.keys(p.tagOwners ?? {})).toEqual(["tag:server", "tag:ci"]);
    expect(p.ssh).toHaveLength(1);
  });

  test("handles HuJSON (comments + trailing commas)", () => {
    const p = parsePolicy(WITH_COMMENTS);
    expect(p.acls).toHaveLength(1);
    expect(p.groups?.["group:admin"]).toEqual(["alice", "bob"]);
  });

  test("rejects invalid input", () => {
    expect(() => parsePolicy("{invalid}")).toThrow();
  });

  test("stringify round-trips preserve data and section-level comments", () => {
    const output = stringifyPolicy(parsePolicy(WITH_COMMENTS));
    expect(output).toContain("// Main access rules");
    expect(output).toContain("// Team groups");
    const reparsed = parsePolicy(output);
    expect(reparsed.acls).toHaveLength(1);
    expect(reparsed.groups?.["group:admin"]).toEqual(["alice", "bob"]);
  });
});

// Tests array generics (appendTo/removeAt/replaceAt) via acl + ssh wrappers
describe("array operations", () => {
  test("append to empty and existing arrays", () => {
    const fromEmpty = addAclRule({}, rule());
    expect(fromEmpty.acls).toHaveLength(1);

    const fromExisting = addAclRule(parsePolicy(FULL), rule({ src: ["group:ops"] }));
    expect(fromExisting.acls).toHaveLength(3);
    expect(fromExisting.acls?.[2].src).toEqual(["group:ops"]);
  });

  test("remove by index, out-of-bounds no-op, and last-element removal", () => {
    const p = parsePolicy(FULL);

    const removed = removeAclRule(p, 0);
    expect(removed.acls).toHaveLength(1);
    expect(removed.acls?.[0].src).toEqual(["group:dev"]);

    // Out of bounds and undefined arrays return same ref
    expect(removeAclRule(p, 99)).toBe(p);
    expect(removeAclRule(p, -1)).toBe(p);
    expect(removeAclRule({}, 0)).toEqual({});

    // Removing last element leaves empty array
    const single = parsePolicy(`{"acls": [{"action":"accept","src":["*"],"dst":["*:*"]}]}`);
    expect(removeAclRule(single, 0).acls).toEqual([]);
  });

  test("replace at index", () => {
    const p = parsePolicy(FULL);
    const updated = updateAclRule(p, 1, rule({ src: ["group:ops"], dst: ["*:443"] }));
    expect(updated.acls?.[1].src).toEqual(["group:ops"]);
    expect(updated.acls?.[0].src).toEqual(["group:admin"]); // untouched
    expect(updateAclRule(p, 99, rule())).toBe(p); // out of bounds
  });

  test("ssh rules use same generics", () => {
    const added = addSshRule({}, ssh());
    expect(added.ssh).toHaveLength(1);

    const p = parsePolicy(FULL);
    expect(removeSshRule(p, 0).ssh).toHaveLength(0);

    const updated = updateSshRule(p, 0, ssh({ action: "check", checkPeriod: "12h" }));
    expect(updated.ssh?.[0].action).toBe("check");
    expect(updated.ssh?.[0].checkPeriod).toBe("12h");
  });
});

// Tests record generics (setEntry/removeEntry) via groups/hosts/tags wrappers
describe("record operations", () => {
  test("set new, overwrite existing, and auto-prefix", () => {
    // Groups: new + overwrite + prefix
    expect(setGroup({}, "ops", ["a"]).groups?.["group:ops"]).toEqual(["a"]);
    const p = parsePolicy(FULL);
    const updated = setGroup(p, "group:admin", ["newuser"]);
    expect(updated.groups?.["group:admin"]).toEqual(["newuser"]);
    expect(updated.groups?.["group:dev"]).toEqual(["user3"]); // sibling untouched

    // Hosts
    expect(setHost({}, "web", "10.0.0.1").hosts?.web).toBe("10.0.0.1");

    // Tags with auto-prefix
    expect(setTagOwner({}, "web", ["group:ops"]).tagOwners?.["tag:web"]).toEqual(["group:ops"]);
  });

  test("remove existing, no-op for missing, and auto-prefix", () => {
    const p = parsePolicy(FULL);

    const r = removeGroup(p, "dev"); // auto-prefixed
    expect(r.groups?.["group:dev"]).toBeUndefined();
    expect(r.groups?.["group:admin"]).toBeDefined();

    expect(removeHost(p, "server1").hosts?.server1).toBeUndefined();
    expect(removeTagOwner(p, "ci").tagOwners?.["tag:ci"]).toBeUndefined();

    // No-op for missing keys
    const noOp = removeGroup(p, "nonexistent");
    expect(Object.keys(noOp.groups ?? {})).toEqual(Object.keys(p.groups ?? {}));
  });
});

describe("immutability", () => {
  test("no mutation function alters the source policy", () => {
    const p = parsePolicy(FULL);
    const snapshot = stringifyPolicy(p);

    addAclRule(p, rule());
    removeAclRule(p, 0);
    updateAclRule(p, 0, rule({ src: ["changed"] }));
    addSshRule(p, ssh());
    removeSshRule(p, 0);
    updateSshRule(p, 0, ssh({ users: ["ubuntu"] }));
    setGroup(p, "new", ["x"]);
    removeGroup(p, "group:admin");
    setHost(p, "server1", "10.0.0.99");
    removeHost(p, "server1");
    setTagOwner(p, "tag:server", ["changed"]);
    removeTagOwner(p, "tag:ci");

    expect(stringifyPolicy(p)).toBe(snapshot);
  });
});

describe("comment preservation", () => {
  test("section-level comments survive mutations on any field", () => {
    const p = parsePolicy(WITH_COMMENTS);
    const output = stringifyPolicy(setHost(p, "web", "10.0.0.5"));
    expect(output).toContain("// Main access rules");
    expect(output).toContain("// Team groups");
  });

  test("inline array element comments are lost on array mutation", () => {
    // comment-json stores inline comments as Symbols on array elements.
    // Spreading into a new array drops them — known tradeoff of immutability.
    const p = parsePolicy(WITH_COMMENTS);
    const output = stringifyPolicy(addAclRule(p, rule()));
    expect(output).not.toContain("// Allow admins everywhere");
    expect(output).toContain("// Main access rules"); // section-level preserved
  });
});

describe("field isolation", () => {
  test("autoApprovers and tests survive unrelated mutations", () => {
    let p = parsePolicy(WITH_EXTRA_FIELDS);
    p = addAclRule(p, rule({ src: ["group:ops"] }));
    p = setGroup(p, "ops", ["admin1"]);
    p = setHost(p, "web", "10.0.0.5");

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.autoApprovers?.routes?.["10.0.0.0/8"]).toEqual(["group:admin"]);
    expect(final.autoApprovers?.exitNode).toEqual(["group:admin"]);
    expect(final.tests).toHaveLength(1);
    expect(final.acls).toHaveLength(2);
  });

  test("groups/hosts/tags/ssh survive acl removal", () => {
    const r = removeAclRule(parsePolicy(FULL), 0);
    expect(Object.keys(r.groups ?? {})).toEqual(["group:admin", "group:dev"]);
    expect(Object.keys(r.hosts ?? {})).toEqual(["server1", "server2"]);
    expect(r.ssh).toHaveLength(1);
  });
});

describe("error handling & edge cases", () => {
  test("parsePolicy rejects invalid JSON but doesn't crash on non-object values", () => {
    expect(() => parsePolicy("{invalid}")).toThrow();
    // comment-json wraps primitives in boxed objects, so just verify no crash
    expect(() => parsePolicy('"just a string"')).not.toThrow();
    expect(() => parsePolicy("null")).not.toThrow();
    expect(() => parsePolicy("42")).not.toThrow();
  });

  test("array ops on undefined fields default to empty", () => {
    const empty: AclPolicy = {};
    // append creates the array
    expect(addAclRule(empty, rule()).acls).toHaveLength(1);
    expect(addSshRule(empty, ssh()).ssh).toHaveLength(1);
    // remove/update on undefined returns same ref (no-op)
    expect(removeAclRule(empty, 0)).toBe(empty);
    expect(updateAclRule(empty, 0, rule())).toBe(empty);
    expect(removeSshRule(empty, 0)).toBe(empty);
    expect(updateSshRule(empty, 0, ssh())).toBe(empty);
  });

  test("record ops on undefined fields default to empty", () => {
    const empty: AclPolicy = {};
    expect(setGroup(empty, "ops", ["a"]).groups?.["group:ops"]).toEqual(["a"]);
    expect(setHost(empty, "web", "10.0.0.1").hosts?.web).toBe("10.0.0.1");
    expect(setTagOwner(empty, "web", ["a"]).tagOwners?.["tag:web"]).toEqual(["a"]);
    // remove from undefined field doesn't crash
    const r1 = removeGroup(empty, "ops");
    expect(r1.groups).toEqual({});
    const r2 = removeHost(empty, "web");
    expect(r2.hosts).toEqual({});
    const r3 = removeTagOwner(empty, "web");
    expect(r3.tagOwners).toEqual({});
  });

  test("out-of-bounds array operations return same reference", () => {
    const p = parsePolicy(FULL);
    expect(removeAclRule(p, -1)).toBe(p);
    expect(removeAclRule(p, 999)).toBe(p);
    expect(updateAclRule(p, -1, rule())).toBe(p);
    expect(updateAclRule(p, 999, rule())).toBe(p);
    expect(removeSshRule(p, -1)).toBe(p);
    expect(updateSshRule(p, 999, ssh())).toBe(p);
  });
});

describe("end-to-end workflows", () => {
  test("build policy from scratch and round-trip", () => {
    let p: AclPolicy = {};
    p = setGroup(p, "admin", ["alice", "bob"]);
    p = setTagOwner(p, "server", ["group:admin"]);
    p = setHost(p, "gateway", "100.64.0.1");
    p = addAclRule(p, rule({ src: ["group:admin"], dst: ["*:*"] }));
    p = addSshRule(p, ssh());

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.groups?.["group:admin"]).toEqual(["alice", "bob"]);
    expect(final.tagOwners?.["tag:server"]).toEqual(["group:admin"]);
    expect(final.hosts?.gateway).toBe("100.64.0.1");
    expect(final.acls).toHaveLength(1);
    expect(final.ssh).toHaveLength(1);
  });

  test("chained add/remove/update across sections", () => {
    let p = parsePolicy(FULL);
    p = addAclRule(p, rule({ src: ["group:temp"] }));
    p = removeAclRule(p, 2); // remove the one we just added
    p = updateAclRule(p, 0, rule({ src: ["group:ops"] }));
    p = setGroup(p, "temp", ["user1"]);
    p = removeGroup(p, "temp");

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.acls).toHaveLength(2);
    expect(final.acls?.[0].src).toEqual(["group:ops"]);
    expect(final.groups?.["group:temp"]).toBeUndefined();
    expect(final.groups?.["group:admin"]).toEqual(["user1", "user2"]);
  });

  test("optional fields (proto, checkPeriod) survive round-trips", () => {
    let p: AclPolicy = {};
    p = addAclRule(p, rule({ proto: "udp", dst: ["*:53"] }));
    p = addSshRule(p, ssh({ action: "check", checkPeriod: "24h" }));

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.acls?.[0].proto).toBe("udp");
    expect(final.ssh?.[0].checkPeriod).toBe("24h");
  });
});
