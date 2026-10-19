import * as v from "valibot";

export const restrictionTypes = ["domain", "group", "user"] as const;
export type RestrictionType = (typeof restrictionTypes)[number];

function isHostname(value: string) {
  try {
    return new URL(`http://${value}`).hostname === value;
  } catch {
    return false;
  }
}

export const restrictionValue = {
  domain: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Enter a domain."),
    v.check(isHostname, "Enter a domain like example.com."),
  ),
  group: v.pipe(v.string(), v.trim(), v.nonEmpty("Enter a group.")),
  user: v.pipe(v.string(), v.trim(), v.nonEmpty("Enter a user.")),
};
