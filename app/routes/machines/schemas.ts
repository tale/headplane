import * as v from "valibot";

export const machineName = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i,
    "Use letters, numbers, and hyphens only, starting and ending with a letter or number.",
  ),
);
