import * as v from "valibot";

export const nameserver = v.pipe(v.string(), v.trim(), v.ip("Enter an IPv4 or IPv6 address."));

export const recordValue = {
  A: v.pipe(v.string(), v.trim(), v.ipv4("Enter an IPv4 address.")),
  AAAA: v.pipe(v.string(), v.trim(), v.ipv6("Enter an IPv6 address.")),
};
