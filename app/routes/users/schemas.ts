import * as v from "valibot";

import { Roles, type Role } from "~/server/web/roles";
import { list } from "~/utils/form";
import { validateUsername } from "~/utils/user";

export const username = v.pipe(
  v.string(),
  v.check((name) => validateUsername(name) === undefined, "Enter a valid username."),
);

const assignableRoles = Object.keys(Roles).filter((role) => role !== "owner") as Exclude<
  Role,
  "owner"
>[];

const optionalText = v.pipe(
  v.optional(v.string(), ""),
  v.trim(),
  v.transform((value) => value || undefined),
);

const id = v.pipe(v.string(), v.minLength(1));
export const userAction = v.variant("intent", [
  v.object({
    intent: v.literal("create"),
    name: username,
    display_name: optionalText,
    email: optionalText,
  }),
  v.object({ intent: v.literal("delete"), headscale_user_id: id }),
  v.object({ intent: v.literal("rename"), headscale_user_id: id, name: username }),
  v.object({
    intent: v.literal("reassign"),
    headplane_user_id: id,
    role: v.picklist(assignableRoles, "Choose a role."),
  }),
  v.object({ intent: v.literal("transfer"), headplane_user_id: id }),
  v.object({
    intent: v.literal("link"),
    headplane_user_id: id,
    headscale_user_id: v.pipe(v.string(), v.minLength(1, "Choose a Headscale user.")),
  }),
  v.object({ intent: v.literal("update_groups"), user_name: id, groups: list() }),
]);
