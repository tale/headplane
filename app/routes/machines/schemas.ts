import * as v from "valibot";

import { list } from "~/utils/form";

export const machineName = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i,
    "Use letters, numbers, and hyphens only, starting and ending with a letter or number.",
  ),
);

const nodeId = v.pipe(v.string(), v.minLength(1));
export const machineAction = v.variant("intent", [
  v.object({
    intent: v.literal("register"),
    register_key: v.pipe(v.string(), v.minLength(1, "Paste the machine key.")),
    user: v.pipe(v.string(), v.minLength(1, "Choose an owner.")),
  }),
  v.object({ intent: v.literal("rename"), node_id: nodeId, name: machineName }),
  v.object({ intent: v.literal("delete"), node_id: nodeId }),
  v.object({ intent: v.literal("expire"), node_id: nodeId }),
  v.object({
    intent: v.literal("toggle_expiry"),
    node_id: nodeId,
    disable_expiry: v.picklist(["true", "false"]),
  }),
  v.object({ intent: v.literal("update_tags"), node_id: nodeId, tags: list(v.string()) }),
  v.object({
    intent: v.literal("update_routes"),
    node_id: nodeId,
    routes: list(v.string()),
    enabled: v.picklist(["true", "false"]),
  }),
  v.object({
    intent: v.literal("reassign"),
    node_id: nodeId,
    user_id: v.pipe(v.string(), v.minLength(1, "Choose an owner.")),
  }),
]);
