import * as v from "valibot";

import { validateUsername } from "~/utils/user";

export const username = v.pipe(
  v.string(),
  v.check((name) => validateUsername(name) === undefined, "Enter a valid username."),
);
