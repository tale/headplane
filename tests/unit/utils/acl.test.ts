import { describe, expect, test } from "vitest";

import { evaluatePolicy } from "~/utils/acl/evaluate";
import { locateRules, locateRuleToken } from "~/utils/acl/locate";
import {
  type AclNode,
  type AclWarning,
  INTERNET,
  isSubnetNodeId,
  subnetCidrOf,
  subnetNodeId,
} from "~/utils/acl/model";
import { parseDst, parsePolicy, parsePorts } from "~/utils/acl/parse";
import {
  countPorts,
  formatPorts,
  mergePortRanges,
  portTokens,
  summarisePorts,
} from "~/utils/acl/ports";

// Fixture tailnet. Deliberately synthetic rather than a copy of any real
// policy: it covers the same shapes the hand-trace exercised (wildcard fan-out,
// same-dst merge, bidirectional pairs, autogroup:internet, bare-IP == /32)
// while staying readable and safe to commit.
//
// web/router are tag-only (no user) — Headscale 0.28+ allows this, and
// to-node.ts maps it to `user: undefined`.
function node(partial: Partial<AclNode> & { id: string }): AclNode {
  return {
    name: `node-${partial.id}`,
    ips: [],
    tags: [],
    routes: [],
    hasExitNode: false,
    ...partial,
  };
}

const ALICE_LAPTOP = node({ id: "1", user: "alice", ips: ["100.64.0.1"] });
const ALICE_PHONE = node({ id: "2", user: "alice", ips: ["100.64.0.2"] });
const BOB_LAPTOP = node({ id: "3", user: "bob", ips: ["100.64.0.3"] });
const WEB = node({ id: "4", tags: ["tag:web"], ips: ["100.64.0.4"] });
const ROUTER = node({
  id: "5",
  tags: ["tag:router"],
  ips: ["100.64.0.5"],
  routes: ["192.168.1.0/24"],
  hasExitNode: true,
});

const NODES = [ALICE_LAPTOP, ALICE_PHONE, BOB_LAPTOP, WEB, ROUTER];

/** Set of "src>dst" pairs, the shape most assertions care about. */
function pairs(policy: string, nodes: AclNode[] = NODES): Set<string> {
  return new Set(evaluatePolicy(policy, nodes).edges.map((e) => `${e.src}>${e.dst}`));
}

function policyOf(...acls: string[]): string {
  return `{ "acls": [ ${acls.join(",")} ] }`;
}

describe("ACL evaluator", () => {
  describe("parsing", () => {
    test("strips HuJSON comments and trailing commas", () => {
      const { policy, warnings } = parsePolicy(`{
        // line comment
        "groups": { "group:eng": ["alice"], },
        /* block
           comment */
        "acls": [ { "action": "accept", "src": ["*"], "dst": ["*:22"] }, ],
      }`);

      expect(warnings).toEqual([]);
      expect(policy.groups["group:eng"]).toEqual(["alice"]);
      expect(policy.acls).toHaveLength(1);
    });

    test("a // sequence inside a string is not treated as a comment", () => {
      const { policy } = parsePolicy(`{ "hosts": { "url": "https://example.com" } }`);
      expect(policy.hosts.url).toBe("https://example.com");
    });

    test("malformed policy degrades to empty rather than throwing", () => {
      const { policy, warnings } = parsePolicy("{ not json");
      expect(policy.acls).toEqual([]);
      expect(warnings[0].message).toMatch(/Failed to parse policy/);
    });

    test("non-accept rules are skipped with a warning", () => {
      const { policy, warnings } = parsePolicy(
        `{ "acls": [ { "action": "deny", "src": ["*"], "dst": ["*:*"] } ] }`,
      );
      expect(policy.acls).toEqual([]);
      expect(warnings[0].message).toMatch(/is not "accept"/);
    });

    test("dst splits on the LAST colon that yields a valid port spec", () => {
      expect(parseDst("tag:web:22").alias).toBe("tag:web");
      expect(parseDst("autogroup:internet:*").alias).toBe("autogroup:internet");
      // IPv6 is colon-dense; first-colon splitting would corrupt it.
      expect(parseDst("fd7a:115c:a1e0::1:80").alias).toBe("fd7a:115c:a1e0::1");
    });

    test("a dst with no valid port spec defaults to all ports, with a warning", () => {
      const warnings: AclWarning[] = [];
      const dst = parseDst("tag:web", warnings, 3);
      expect(dst.alias).toBe("tag:web");
      expect(dst.ports).toEqual([{ start: 0, end: 65535 }]);
      expect(warnings[0].message).toMatch(/acls\[3\]/);
      expect(warnings[0].ruleIndex).toBe(3);
    });

    test("port specs cover wildcard, singles, lists and ranges", () => {
      expect(parsePorts("*")).toEqual([{ start: 0, end: 65535 }]);
      expect(parsePorts("22")).toEqual([{ start: 22, end: 22 }]);
      expect(parsePorts("22,8000-8100")).toEqual([
        { start: 22, end: 22 },
        { start: 8000, end: 8100 },
      ]);
    });
  });

  describe("locating rules in the source text", () => {
    /** The slice each range points at, for readable assertions. */
    function slices(policy: string): string[] {
      return locateRules(policy).map((r) => policy.slice(r.start, r.end));
    }

    test("returns one range per rule, pointing at the rule text", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] },
          { "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }
        ]
      }`;

      expect(slices(policy)).toEqual([
        `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }`,
        `{ "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }`,
      ]);
    });

    test("indexes line up with the rules the evaluator reports", () => {
      // acls[1] is non-accept and skipped by the parser, but the surviving
      // rule keeps index 2 — the UI looks rules up by index, so a mismatch
      // here would highlight the wrong block.
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] },
          { "action": "deny", "src": ["bob"], "dst": ["tag:web:80"] },
          { "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }
        ]
      }`;

      const ranges = locateRules(policy);
      const { rules } = evaluatePolicy(policy, NODES);

      expect(ranges.map((r) => r.index)).toEqual([0, 1, 2]);
      for (const rule of rules) {
        const range = ranges.find((r) => r.index === rule.index);
        expect(policy.slice(range!.start, range!.end)).toContain(rule.src[0]);
      }
    });

    test("comments between rules do not shift or split ranges", () => {
      const policy = `{
        "acls": [
          // first rule
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] },
          /* second, with a , and a } inside the comment */
          { "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }
        ]
      }`;

      expect(slices(policy)).toEqual([
        `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }`,
        `{ "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }`,
      ]);
    });

    test("braces and commas inside strings do not end a rule early", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["a},b"], "dst": ["tag:web:80"] }
        ]
      }`;

      expect(slices(policy)).toEqual([
        `{ "action": "accept", "src": ["a},b"], "dst": ["tag:web:80"] }`,
      ]);
    });

    test("a trailing comma does not invent an extra rule", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] },
        ]
      }`;

      expect(locateRules(policy)).toHaveLength(1);
    });

    test("rules spanning multiple lines are captured whole", () => {
      const policy = `{
        "acls": [
          {
            "action": "accept",
            "src": ["alice"],
            "dst": ["tag:web:80"]
          }
        ]
      }`;

      const [range] = locateRules(policy);
      const text = policy.slice(range.start, range.end);
      expect(text.startsWith("{")).toBe(true);
      expect(text.endsWith("}")).toBe(true);
      expect(text).toContain("alice");
    });

    test("an acls key nested inside another value is not mistaken for the real one", () => {
      const policy = `{
        "hosts": { "acls": "10.0.0.0/8" },
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }
        ]
      }`;

      expect(slices(policy)).toEqual([
        `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }`,
      ]);
    });

    test("a token can be narrowed to within its rule", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] },
          { "action": "accept", "src": ["nobody"], "dst": ["tag:web:80"] }
        ]
      }`;

      const rule = locateRules(policy).find((r) => r.index === 1)!;
      const token = locateRuleToken(policy, rule, "nobody")!;

      expect(policy.slice(token.start, token.end)).toBe("nobody");
      // Inside the offending rule, not the identical text elsewhere.
      expect(token.start).toBeGreaterThan(rule.start);
      expect(token.end).toBeLessThan(rule.end);
    });

    test("the quoted form wins, so a short token cannot match inside a longer one", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["bobcat", "bob"], "dst": ["tag:web:80"] }
        ]
      }`;

      const rule = locateRules(policy)[0];
      const token = locateRuleToken(policy, rule, "bob")!;
      // "bobcat" appears first; only the quoted match is the real "bob".
      expect(policy.slice(token.start - 1, token.end + 1)).toBe(`"bob"`);
    });

    test("a dst alias falls back to a bare match, since ports follow it", () => {
      const policy = `{
        "acls": [
          { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }
        ]
      }`;

      const rule = locateRules(policy)[0];
      const token = locateRuleToken(policy, rule, "tag:web")!;
      expect(policy.slice(token.start, token.end)).toBe("tag:web");
    });

    test("a token that is not in the rule reports nothing to highlight", () => {
      const policy = `{ "acls": [ { "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] } ] }`;
      expect(locateRuleToken(policy, locateRules(policy)[0], "absent")).toBeNull();
    });

    test("a policy with no acls yields no ranges", () => {
      expect(locateRules(`{ "groups": { "group:eng": ["alice"] } }`)).toEqual([]);
      expect(locateRules("not json at all")).toEqual([]);
    });
  });

  describe("port display", () => {
    test("adjacent single ports fuse into a range", () => {
      expect(
        mergePortRanges([
          { start: 2456, end: 2456 },
          { start: 2457, end: 2457 },
          { start: 2458, end: 2458 },
        ]),
      ).toEqual([{ start: 2456, end: 2458 }]);
    });

    test("overlapping ranges fuse, gaps are preserved", () => {
      expect(
        mergePortRanges([
          { start: 80, end: 90 },
          { start: 85, end: 100 },
        ]),
      ).toEqual([{ start: 80, end: 100 }]);

      expect(
        mergePortRanges([
          { start: 22, end: 22 },
          { start: 80, end: 80 },
        ]),
      ).toEqual([
        { start: 22, end: 22 },
        { start: 80, end: 80 },
      ]);
    });

    test("unsorted input is normalised before merging", () => {
      expect(
        mergePortRanges([
          { start: 2458, end: 2458 },
          { start: 2456, end: 2456 },
          { start: 2457, end: 2457 },
        ]),
      ).toEqual([{ start: 2456, end: 2458 }]);
    });

    test("the full range renders as a wildcard, not 0-65535", () => {
      expect(portTokens([{ start: 0, end: 65535 }])).toEqual(["*"]);
      expect(summarisePorts([{ start: 0, end: 65535 }])).toBe("all ports");
    });

    test("formatting collapses runs", () => {
      const ports = parsePorts("111,2049,2456,2457,2458");
      expect(formatPorts(ports)).toBe("111, 2049, 2456-2458");
    });

    test("counting spans ranges rather than tokens", () => {
      expect(countPorts(parsePorts("111,2049,2456,2457,2458"))).toBe(5);
      expect(countPorts(parsePorts("8000-8100"))).toBe(101);
    });

    test("the header summary shows values when few and a count when many", () => {
      expect(summarisePorts(parsePorts("22"))).toBe("22");
      expect(summarisePorts(parsePorts("22,80,443"))).toBe("22, 80, 443");
      // The screenshot case: too many to read at a glance, so count instead.
      expect(summarisePorts(parsePorts("2049,111,20048,32803,8096,5055"))).toBe("6 ports");
    });
  });

  describe("reachability", () => {
    test("wildcard fan-out reaches every peer and drops self-loops", () => {
      const { edges } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["*"], "dst": ["*:22"] }`),
        NODES,
      );

      // 5 nodes -> every ordered pair except self = 5 * 4.
      expect(edges).toHaveLength(20);
      expect(edges.some((e) => e.src === e.dst)).toBe(false);
    });

    test("rules allowing the same pair merge onto one edge", () => {
      const { edges } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }`,
          `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:443"] }`,
        ),
        NODES,
      );

      const edge = edges.find((e) => e.src === "1" && e.dst === "4");
      expect(edge?.rules.map((r) => r.ruleIndex)).toEqual([0, 1]);
      expect(edge?.rules[1].ports).toEqual([{ start: 443, end: 443 }]);
    });

    test("edges are directional — a bidirectional pair is two edges", () => {
      const found = pairs(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["bob:3000"] }`,
          `{ "action": "accept", "src": ["bob"], "dst": ["alice:3000"] }`,
        ),
      );

      expect(found.has("1>3")).toBe(true);
      expect(found.has("3>1")).toBe(true);
    });

    test("each edge rule records the dst token that matched it", () => {
      // A rule can name many destinations; the panel must show only the one
      // that produced this edge, not the rule's whole dst list.
      const { edges } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80", "bob:22", "100.64.0.5:*"] }`,
        ),
        NODES,
      );

      const toWeb = edges.find((e) => e.src === "1" && e.dst === "4");
      const toBob = edges.find((e) => e.src === "1" && e.dst === "3");
      expect(toWeb?.rules[0].dstAlias).toBe("tag:web");
      expect(toBob?.rules[0].dstAlias).toBe("bob");
    });

    test("proto and ports ride along on the edge for click-through", () => {
      const { edges } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "proto": "tcp", "src": ["alice"], "dst": ["tag:web:22,8000-8100"] }`,
        ),
        NODES,
      );

      expect(edges[0].rules[0].proto).toBe("tcp");
      expect(edges[0].rules[0].ports).toEqual([
        { start: 22, end: 22 },
        { start: 8000, end: 8100 },
      ]);
    });

    test("parsed rules are exposed, indexed by source position not array slot", () => {
      // acls[1] is skipped as non-accept, so the surviving rule keeps index 2
      // even though it is the second entry in the array.
      const { rules } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:80"] }`,
          `{ "action": "deny", "src": ["bob"], "dst": ["tag:web:80"] }`,
          `{ "action": "accept", "src": ["bob"], "dst": ["tag:web:443"] }`,
        ),
        NODES,
      );

      expect(rules.map((r) => r.index)).toEqual([0, 2]);
      expect(rules[1].src).toEqual(["bob"]);
      expect(rules[1].dst[0].raw).toBe("tag:web:443");
    });

    test("reachOut and reachIn are inverses of the edge list", () => {
      const { reachOut, reachIn } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(reachOut.get("1")).toEqual(["4"]);
      expect(reachOut.get("2")).toEqual(["4"]);
      expect(reachIn.get("4")?.sort()).toEqual(["1", "2"]);
      expect(reachIn.has("1")).toBe(false);
    });
  });

  describe("alias expansion", () => {
    test("a bare user token matches all of that user's nodes", () => {
      expect(pairs(policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["bob:*"] }`))).toEqual(
        new Set(["1>3", "2>3"]),
      );
    });

    test("a trailing @ on a user token is normalized away", () => {
      expect(
        pairs(policyOf(`{ "action": "accept", "src": ["alice@"], "dst": ["bob@:*"] }`)),
      ).toEqual(new Set(["1>3", "2>3"]));
    });

    test("groups expand recursively through nested groups", () => {
      const found = pairs(`{
        "groups": {
          "group:eng": ["alice", "group:ops"],
          "group:ops": ["bob"]
        },
        "acls": [ { "action": "accept", "src": ["group:eng"], "dst": ["tag:web:*"] } ]
      }`);

      expect(found).toEqual(new Set(["1>4", "2>4", "3>4"]));
    });

    test("a group cycle terminates instead of hanging", () => {
      const found = pairs(`{
        "groups": { "group:a": ["group:b"], "group:b": ["group:a", "alice"] },
        "acls": [ { "action": "accept", "src": ["group:a"], "dst": ["tag:web:*"] } ]
      }`);

      expect(found).toEqual(new Set(["1>4", "2>4"]));
    });

    test("autogroup:member is untagged user devices; autogroup:tagged is the rest", () => {
      expect(
        pairs(
          policyOf(`{ "action": "accept", "src": ["autogroup:member"], "dst": ["tag:web:*"] }`),
        ),
      ).toEqual(new Set(["1>4", "2>4", "3>4"]));

      expect(
        pairs(policyOf(`{ "action": "accept", "src": ["autogroup:tagged"], "dst": ["bob:*"] }`)),
      ).toEqual(new Set(["4>3", "5>3"]));
    });

    test("host aliases resolve through their CIDR", () => {
      const found = pairs(`{
        "hosts": { "server": "100.64.0.3/32" },
        "acls": [ { "action": "accept", "src": ["alice"], "dst": ["server:80"] } ]
      }`);

      expect(found).toEqual(new Set(["1>3", "2>3"]));
    });

    test("a bare IP behaves as a /32, and a CIDR matches every node inside it", () => {
      expect(
        pairs(policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["100.64.0.3:80"] }`)),
      ).toEqual(new Set(["1>3", "2>3"]));

      expect(
        pairs(
          policyOf(`{ "action": "accept", "src": ["100.64.0.1/32"], "dst": ["100.64.0.0/24:*"] }`),
        ),
      ).toEqual(new Set(["1>2", "1>3", "1>4", "1>5"]));
    });
  });

  describe("autogroup:self couples src and dst", () => {
    // The load-bearing decision: dst is expanded per-src, so autogroup:self
    // resolves against each source node's owner. A single static matrix would
    // get this wrong.
    test("resolves to the source node's own untagged devices", () => {
      const found = pairs(
        policyOf(`{ "action": "accept", "src": ["*"], "dst": ["autogroup:self:*"] }`),
      );

      // alice's two devices see each other; bob has only one, so he gets none.
      expect(found).toEqual(new Set(["1>2", "2>1"]));
    });

    test("a tag-only source has no owner, so it warns instead of matching", () => {
      const { edges, warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["tag:web"], "dst": ["autogroup:self:*"] }`),
        NODES,
      );

      expect(edges).toEqual([]);
      expect(warnings.some((w) => /autogroup:self needs a dst context/.test(w.message))).toBe(true);
    });

    test("it is omitted from static expansions, which have no answer for it", () => {
      const { expansions } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["autogroup:self:*", "tag:web:*"] }`,
        ),
        NODES,
      );

      expect(expansions.has("autogroup:self")).toBe(false);
      expect(expansions.get("tag:web")).toEqual(["4"]);
      expect(expansions.get("alice")).toEqual(["1", "2"]);
    });
  });

  describe("the internet sentinel", () => {
    test("autogroup:internet becomes one edge per source to a single hub", () => {
      const { edges } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["autogroup:internet:*"] }`),
        NODES,
      );

      expect(edges.map((e) => `${e.src}>${e.dst}`).sort()).toEqual([
        `1>${INTERNET}`,
        `2>${INTERNET}`,
      ]);
      // The hub is a sentinel, never a real node id.
      expect(NODES.some((n) => n.id === INTERNET)).toBe(false);
    });

    test("it is rejected as a src", () => {
      const { edges, warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["autogroup:internet"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(edges).toEqual([]);
      expect(warnings.some((w) => /not valid as a src/.test(w.message))).toBe(true);
    });
  });

  describe("warnings", () => {
    test("an alias matching nothing is reported", () => {
      const { warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["nobody"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(warnings.some((w) => /Unresolved alias "nobody"/.test(w.message))).toBe(true);
    });

    test("an undefined group is reported", () => {
      const { warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["group:ghost"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(warnings.some((w) => /Undefined group "group:ghost"/.test(w.message))).toBe(true);
    });

    test("warnings carry the rule that caused them, so the UI can jump there", () => {
      const { warnings } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["tag:web:*"] }`,
          `{ "action": "accept", "src": ["nobody"], "dst": ["tag:web:*"] }`,
        ),
        NODES,
      );

      const unresolved = warnings.find((w) => /Unresolved alias/.test(w.message));
      expect(unresolved?.ruleIndex).toBe(1);
    });

    test("an unknown autogroup is reported", () => {
      const { warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["autogroup:nonsense"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(warnings.some((w) => /Unknown autogroup/.test(w.message))).toBe(true);
    });
  });

  describe("resilience against unfamiliar policies", () => {
    // This feature was built against a single real policy, so the evaluator
    // has to survive shapes nobody here has seen.
    test.each([
      ["no acls key at all", "{}"],
      ["acls is not an array", `{ "acls": {} }`],
      ["a rule missing src and dst", `{ "acls": [ { "action": "accept" } ] }`],
      [
        "src and dst of the wrong type",
        `{ "acls": [ { "action": "accept", "src": 1, "dst": 2 } ] }`,
      ],
      ["a null entry in the rule list", `{ "acls": [ null ] }`],
      [
        "nonsense port specs",
        `{ "acls": [ { "action": "accept", "src": ["*"], "dst": ["*:abc"] } ] }`,
      ],
      ["a negative port", `{ "acls": [ { "action": "accept", "src": ["*"], "dst": ["*:-5"] } ] }`],
      ["an empty policy", ""],
      ["only a comment", "// nothing here"],
      [
        "deeply nested junk",
        `{ "acls": [ { "action": "accept", "src": [[[["*"]]]], "dst": [{}] } ] }`,
      ],
    ])("does not throw on %s", (_label, policy) => {
      expect(() => evaluatePolicy(policy, NODES)).not.toThrow();
    });

    test("a group that includes itself terminates", () => {
      expect(() =>
        evaluatePolicy(
          `{
            "groups": { "group:loop": ["group:loop"] },
            "acls": [ { "action": "accept", "src": ["group:loop"], "dst": ["tag:web:*"] } ]
          }`,
          NODES,
        ),
      ).not.toThrow();
    });

    test("a wildcard blow-up is capped rather than left to hang the browser", () => {
      // 200 nodes with *:* is 39,800 edges; the cap keeps it well under that.
      const many = Array.from({ length: 200 }, (_, i) =>
        node({ id: `n${i}`, user: `user${i}`, ips: [`10.1.${Math.floor(i / 256)}.${i % 256}`] }),
      );

      const { edges, warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["*"], "dst": ["*:*"] }`),
        many,
      );

      expect(edges.length).toBeLessThanOrEqual(20_000);
      expect(warnings.some((w) => /more than .* flows/.test(w.message))).toBe(true);
    });
  });

  describe("off-mesh subnets", () => {
    test("a dst CIDR matching no node becomes a subnet pseudo-node", () => {
      const { edges, subnets, warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["192.168.1.0/24:*"] }`),
        NODES,
      );

      const id = subnetNodeId("192.168.1.0/24");
      expect(edges.map((e) => `${e.src}>${e.dst}`).sort()).toEqual([`1>${id}`, `2>${id}`]);
      expect(subnets).toEqual([{ id, cidr: "192.168.1.0/24", routers: ["5"] }]);
      expect(warnings).toEqual([]);
    });

    test("each distinct CIDR gets its own node rather than one shared hub", () => {
      const { subnets } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["192.168.1.0/24:*", "10.0.0.0/8:*"] }`,
        ),
        NODES,
      );

      expect(subnets.map((s) => s.cidr).sort()).toEqual(["10.0.0.0/8", "192.168.1.0/24"]);
    });

    test("the same CIDR reached from two rules collapses to one node", () => {
      const { subnets } = evaluatePolicy(
        policyOf(
          `{ "action": "accept", "src": ["alice"], "dst": ["192.168.1.0/24:80"] }`,
          `{ "action": "accept", "src": ["bob"], "dst": ["192.168.1.0/24:443"] }`,
        ),
        NODES,
      );

      expect(subnets).toHaveLength(1);
    });

    test("routers are found by route containment, not just exact match", () => {
      // ROUTER advertises 192.168.1.0/24, which covers this narrower dst.
      const { subnets } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["192.168.1.128/25:*"] }`),
        NODES,
      );

      expect(subnets[0].routers).toEqual(["5"]);
    });

    test("a route narrower than the dst does not count as routing it", () => {
      // This router advertises 192.168.0.0/24, which sits INSIDE the /16 dst
      // and shares its prefix — so only the mask comparison rejects it.
      const narrowRouter = node({
        id: "9",
        tags: ["tag:r2"],
        ips: ["100.64.0.9"],
        routes: ["192.168.0.0/24"],
      });

      const { subnets } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["192.168.0.0/16:*"] }`),
        [...NODES, narrowRouter],
      );

      expect(subnets[0].routers).toEqual([]);
    });

    test("an unrouted subnet is still drawn, but with no routers", () => {
      const { subnets } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["172.16.0.0/12:*"] }`),
        NODES,
      );

      expect(subnets[0].routers).toEqual([]);
    });

    test("a host alias pointing off-mesh becomes a subnet too", () => {
      const { edges, subnets } = evaluatePolicy(
        `{
          "hosts": { "lan": "192.168.1.0/24" },
          "acls": [ { "action": "accept", "src": ["alice"], "dst": ["lan:443"] } ]
        }`,
        NODES,
      );

      expect(subnets[0].cidr).toBe("192.168.1.0/24");
      expect(edges).toHaveLength(2);
    });

    test("a CIDR that does match real nodes stays a normal edge", () => {
      const { edges, subnets } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["alice"], "dst": ["100.64.0.0/24:*"] }`),
        NODES,
      );

      expect(subnets).toEqual([]);
      expect(edges.every((e) => !isSubnetNodeId(e.dst))).toBe(true);
    });

    test("an off-mesh range as src is reported, not silently dropped", () => {
      const { edges, subnets, warnings } = evaluatePolicy(
        policyOf(`{ "action": "accept", "src": ["192.168.1.0/24"], "dst": ["tag:web:*"] }`),
        NODES,
      );

      expect(edges).toEqual([]);
      expect(subnets).toEqual([]); // src side never mints a pseudo-node
      expect(warnings.some((w) => /as src cannot be drawn/.test(w.message))).toBe(true);
    });

    test("subnet ids round-trip back to their CIDR", () => {
      expect(subnetCidrOf(subnetNodeId("192.168.1.0/24"))).toBe("192.168.1.0/24");
      expect(subnetCidrOf("3")).toBeNull();
      expect(isSubnetNodeId(INTERNET)).toBe(false);
    });
  });
});
