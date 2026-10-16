import * as v from "valibot";
import { describe, expect, test } from "vitest";

import { formValues, list, parseValues } from "~/utils/form";

function values(entries: [string, string][]) {
  const body = new FormData();
  for (const [key, value] of entries) {
    body.append(key, value);
  }

  return formValues(body);
}

describe("parseValues", () => {
  test("list() accepts many, one, or no values", () => {
    const schema = v.object({ tags: list(v.string()) });

    const many = parseValues(
      schema,
      values([
        ["tags", "tag:a"],
        ["tags", "tag:b"],
      ]),
    );
    const one = parseValues(schema, values([["tags", "tag:a"]]));
    const none = parseValues(schema, values([]));

    expect(many).toEqual({ ok: true, data: { tags: ["tag:a", "tag:b"] } });
    expect(one).toEqual({ ok: true, data: { tags: ["tag:a"] } });
    expect(none).toEqual({ ok: true, data: { tags: [] } });
  });

  test("keys field errors by name and other errors as form", () => {
    const schema = v.pipe(
      v.object({ name: v.pipe(v.string(), v.minLength(1, "Enter a name.")), confirm: v.string() }),
      v.check((input) => input.confirm === "yes", "Confirm the change."),
    );

    const field = parseValues(
      schema,
      values([
        ["name", ""],
        ["confirm", "yes"],
      ]),
    );
    const form = parseValues(
      schema,
      values([
        ["name", "nas"],
        ["confirm", "no"],
      ]),
    );

    expect(field).toEqual({ ok: false, errors: { name: "Enter a name." } });
    expect(form).toEqual({ ok: false, errors: { form: "Confirm the change." } });
  });
});
