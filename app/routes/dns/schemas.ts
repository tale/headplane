import * as v from "valibot";

const text = (message: string) => v.pipe(v.string(), v.trim(), v.nonEmpty(message));

// Empty means the global nameservers rather than a split DNS domain.
const splitDomain = v.pipe(
  v.optional(v.string(), ""),
  v.trim(),
  v.transform((value) => value || undefined),
);

export const nameserver = v.pipe(v.string(), v.trim(), v.ip("Enter an IPv4 or IPv6 address."));

export const recordValue = {
  A: v.pipe(v.string(), v.trim(), v.ipv4("Enter an IPv4 address.")),
  AAAA: v.pipe(v.string(), v.trim(), v.ipv6("Enter an IPv6 address.")),
};

const record = (type: keyof typeof recordValue) =>
  v.object({
    intent: v.literal("add_record"),
    type: v.literal(type),
    name: text("Enter a domain."),
    value: recordValue[type],
  });

export const dnsAction = v.variant("intent", [
  v.object({ intent: v.literal("rename_tailnet"), name: text("Enter a tailnet name.") }),
  v.object({ intent: v.literal("toggle_magic"), enabled: v.picklist(["true", "false"]) }),
  v.object({ intent: v.literal("override_dns"), enabled: v.picklist(["true", "false"]) }),
  v.object({ intent: v.literal("add_ns"), nameserver, split_domain: splitDomain }),
  v.object({ intent: v.literal("remove_ns"), nameserver: v.string(), split_domain: splitDomain }),
  v.object({ intent: v.literal("add_domain"), domain: text("Enter a search domain.") }),
  v.object({ intent: v.literal("remove_domain"), domain: v.string() }),
  v.object({
    intent: v.literal("move_domain"),
    domain: v.string(),
    direction: v.picklist(["up", "down"]),
  }),
  v.variant("type", [record("A"), record("AAAA")]),
  v.object({
    intent: v.literal("remove_record"),
    type: v.string(),
    name: v.string(),
  }),
]);
