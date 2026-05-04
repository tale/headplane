import { describe, expect, test } from "vitest";

import {
  type AclPolicy,
  type AclRule,
  type SshRule,
  addAclRule,
  addSshRule,
  groupKey,
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
  tagKey,
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

describe("parsePolicy", () => {
  test("empty input returns empty object", () => {
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

  test("handles HuJSON comments and trailing commas", () => {
    const p = parsePolicy(WITH_COMMENTS);
    expect(p.acls).toHaveLength(1);
    expect(p.groups?.["group:admin"]).toEqual(["alice", "bob"]);
  });

  test("parses policy with empty arrays", () => {
    const p = parsePolicy(`{"acls": [], "ssh": []}`);
    expect(p.acls).toEqual([]);
    expect(p.ssh).toEqual([]);
  });

  test("throws on invalid JSON", () => {
    expect(() => parsePolicy("{invalid}")).toThrow();
  });
});

describe("stringifyPolicy", () => {
  test("round-trips preserve data", () => {
    const final = parsePolicy(stringifyPolicy(parsePolicy(FULL)));
    expect(final.acls).toHaveLength(2);
    expect(final.groups?.["group:admin"]).toEqual(["user1", "user2"]);
    expect(final.hosts?.server1).toBe("100.64.0.1");
  });

  test("preserves section-level HuJSON comments", () => {
    const output = stringifyPolicy(parsePolicy(WITH_COMMENTS));
    expect(output).toContain("// Main access rules");
    expect(output).toContain("// Team groups");
  });
});

describe("groupKey / tagKey", () => {
  test("adds prefix when missing", () => {
    expect(groupKey("admin")).toBe("group:admin");
    expect(tagKey("server")).toBe("tag:server");
  });

  test("is idempotent when prefix already present", () => {
    expect(groupKey("group:admin")).toBe("group:admin");
    expect(tagKey("tag:server")).toBe("tag:server");
  });
});

describe("array operations", () => {
  test("appends to empty and existing arrays", () => {
    expect(addAclRule({}, rule()).acls).toHaveLength(1);

    const added = addAclRule(parsePolicy(FULL), rule({ src: ["group:ops"] }));
    expect(added.acls).toHaveLength(3);
    expect(added.acls?.[2].src).toEqual(["group:ops"]);
  });

  test("appends to an already-empty array field", () => {
    const p = parsePolicy(`{"acls": []}`);
    const added = addAclRule(p, rule());
    expect(added.acls).toHaveLength(1);
  });

  test("removes by index", () => {
    const removed = removeAclRule(parsePolicy(FULL), 0);
    expect(removed.acls).toHaveLength(1);
    expect(removed.acls?.[0].src).toEqual(["group:dev"]);
  });

  test("removing last element leaves empty array", () => {
    const single = parsePolicy(`{"acls": [{"action":"accept","src":["*"],"dst":["*:*"]}]}`);
    expect(removeAclRule(single, 0).acls).toEqual([]);
  });

  test("replaces at index without affecting siblings", () => {
    const updated = updateAclRule(parsePolicy(FULL), 1, rule({ src: ["group:ops"] }));
    expect(updated.acls?.[1].src).toEqual(["group:ops"]);
    expect(updated.acls?.[0].src).toEqual(["group:admin"]);
  });

  test("out-of-bounds and undefined arrays return same reference", () => {
    const p = parsePolicy(FULL);
    expect(removeAclRule(p, -1)).toBe(p);
    expect(removeAclRule(p, 999)).toBe(p);
    expect(updateAclRule(p, -1, rule())).toBe(p);
    expect(updateAclRule(p, 999, rule())).toBe(p);

    const empty: AclPolicy = {};
    expect(removeAclRule(empty, 0)).toBe(empty);
    expect(updateAclRule(empty, 0, rule())).toBe(empty);
  });

  test("ssh rules use the same mechanics", () => {
    expect(addSshRule({}, ssh()).ssh).toHaveLength(1);
    expect(removeSshRule(parsePolicy(FULL), 0).ssh).toHaveLength(0);

    const updated = updateSshRule(
      parsePolicy(FULL),
      0,
      ssh({ action: "check", checkPeriod: "12h" }),
    );
    expect(updated.ssh?.[0].action).toBe("check");
    expect(updated.ssh?.[0].checkPeriod).toBe("12h");
  });
});

describe("record operations", () => {
  test("sets new entries with auto-prefix", () => {
    expect(setGroup({}, "ops", ["a"]).groups?.["group:ops"]).toEqual(["a"]);
    expect(setHost({}, "web", "10.0.0.1").hosts?.web).toBe("10.0.0.1");
    expect(setTagOwner({}, "web", ["group:ops"]).tagOwners?.["tag:web"]).toEqual(["group:ops"]);
  });

  test("overwrites existing entries without affecting siblings", () => {
    const updated = setGroup(parsePolicy(FULL), "group:admin", ["newuser"]);
    expect(updated.groups?.["group:admin"]).toEqual(["newuser"]);
    expect(updated.groups?.["group:dev"]).toEqual(["user3"]);
  });

  test("allows setting empty member lists", () => {
    const p = setGroup({}, "empty", []);
    expect(p.groups?.["group:empty"]).toEqual([]);
  });

  test("removes entries with auto-prefix", () => {
    const p = parsePolicy(FULL);
    expect(removeGroup(p, "dev").groups?.["group:dev"]).toBeUndefined();
    expect(removeHost(p, "server1").hosts?.server1).toBeUndefined();
    expect(removeTagOwner(p, "ci").tagOwners?.["tag:ci"]).toBeUndefined();
  });

  test("removing non-existent keys leaves record unchanged", () => {
    const p = parsePolicy(FULL);
    expect(Object.keys(removeGroup(p, "nonexistent").groups ?? {})).toEqual(
      Object.keys(p.groups ?? {}),
    );
  });

  test("operations on undefined fields produce empty records", () => {
    const empty: AclPolicy = {};
    expect(removeGroup(empty, "ops").groups).toEqual({});
    expect(removeHost(empty, "web").hosts).toEqual({});
    expect(removeTagOwner(empty, "web").tagOwners).toEqual({});
  });

  test("rename via remove+set preserves siblings", () => {
    const p = parsePolicy(FULL);
    const renamed = setGroup(removeGroup(p, "group:dev"), "group:engineering", ["user3", "user4"]);
    expect(renamed.groups?.["group:dev"]).toBeUndefined();
    expect(renamed.groups?.["group:engineering"]).toEqual(["user3", "user4"]);
    expect(renamed.groups?.["group:admin"]).toEqual(["user1", "user2"]);
  });
});

describe("immutability", () => {
  test("mutations never alter the source policy", () => {
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

describe("field isolation", () => {
  test("unrecognized fields survive mutations", () => {
    let p = parsePolicy(WITH_EXTRA_FIELDS);
    p = addAclRule(p, rule({ src: ["group:ops"] }));
    p = setGroup(p, "ops", ["admin1"]);

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.autoApprovers?.routes?.["10.0.0.0/8"]).toEqual(["group:admin"]);
    expect(final.autoApprovers?.exitNode).toEqual(["group:admin"]);
    expect(final.tests).toHaveLength(1);
  });

  test("sibling sections survive targeted removal", () => {
    const r = removeAclRule(parsePolicy(FULL), 0);
    expect(Object.keys(r.groups ?? {})).toEqual(["group:admin", "group:dev"]);
    expect(Object.keys(r.hosts ?? {})).toEqual(["server1", "server2"]);
    expect(r.ssh).toHaveLength(1);
  });

  test("section-level comments survive mutations on other fields", () => {
    const output = stringifyPolicy(setHost(parsePolicy(WITH_COMMENTS), "web", "10.0.0.5"));
    expect(output).toContain("// Main access rules");
    expect(output).toContain("// Team groups");
  });
});

describe("end-to-end", () => {
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

  test("chained mutations across sections", () => {
    let p = parsePolicy(FULL);
    p = addAclRule(p, rule({ src: ["group:temp"] }));
    p = removeAclRule(p, 2);
    p = updateAclRule(p, 0, rule({ src: ["group:ops"] }));
    p = setGroup(p, "temp", ["user1"]);
    p = removeGroup(p, "temp");

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.acls).toHaveLength(2);
    expect(final.acls?.[0].src).toEqual(["group:ops"]);
    expect(final.groups?.["group:temp"]).toBeUndefined();
    expect(final.groups?.["group:admin"]).toEqual(["user1", "user2"]);
  });

  test("optional fields survive round-trips", () => {
    let p: AclPolicy = {};
    p = addAclRule(p, rule({ proto: "udp", dst: ["*:53"] }));
    p = addSshRule(p, ssh({ action: "check", checkPeriod: "24h" }));

    const final = parsePolicy(stringifyPolicy(p));
    expect(final.acls?.[0].proto).toBe("udp");
    expect(final.ssh?.[0].checkPeriod).toBe("24h");
  });

  test("realistic policy with multiple mutation passes", () => {
    let p: AclPolicy = {};

    p = setGroup(p, "engineering", ["alice", "bob", "charlie"]);
    p = setGroup(p, "ops", ["dave", "eve"]);
    p = setGroup(p, "contractors", ["frank"]);
    p = setHost(p, "prod-db", "100.64.1.10");
    p = setHost(p, "staging-db", "100.64.2.10");
    p = setHost(p, "monitoring", "100.64.3.1");
    p = setTagOwner(p, "production", ["group:ops"]);
    p = setTagOwner(p, "staging", ["group:engineering", "group:ops"]);
    p = addAclRule(p, rule({ src: ["group:ops"], dst: ["*:*"] }));
    p = addAclRule(p, rule({ src: ["group:engineering"], dst: ["tag:staging:*"] }));
    p = addAclRule(p, rule({ src: ["group:contractors"], dst: ["tag:staging:443"] }));
    p = addSshRule(
      p,
      ssh({ src: ["group:ops"], dst: ["tag:production"], users: ["root", "ubuntu"] }),
    );
    p = addSshRule(
      p,
      ssh({
        action: "check",
        src: ["group:engineering"],
        dst: ["tag:staging"],
        users: ["ubuntu"],
        checkPeriod: "12h",
      }),
    );

    // Simulate ongoing edits: rename group, remove contractor access, add host
    p = setGroup(removeGroup(p, "contractors"), "external", ["frank", "grace"]);
    p = updateAclRule(p, 2, rule({ src: ["group:external"], dst: ["tag:staging:443"] }));
    p = setHost(p, "cache", "100.64.3.5");
    p = removeHost(p, "monitoring");

    const final = parsePolicy(stringifyPolicy(p));
    expect(Object.keys(final.groups ?? {})).toHaveLength(3);
    expect(final.groups?.["group:external"]).toEqual(["frank", "grace"]);
    expect(final.groups?.["group:contractors"]).toBeUndefined();
    expect(final.hosts?.cache).toBe("100.64.3.5");
    expect(final.hosts?.monitoring).toBeUndefined();
    expect(final.acls).toHaveLength(3);
    expect(final.acls?.[2].src).toEqual(["group:external"]);
    expect(final.ssh).toHaveLength(2);
    expect(final.ssh?.[1].checkPeriod).toBe("12h");
  });
});
