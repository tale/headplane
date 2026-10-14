import * as v from "valibot";
import { describe, expect, test } from "vitest";

import { list, parseForm } from "~/utils/form";

function post(entries: [string, string][]) {
  const body = new FormData();
  for (const [key, value] of entries) {
    body.append(key, value);
  }

  return new Request("http://localhost/", { method: "POST", body });
}

describe("parseForm", () => {
  test("list() accepts many, one, or no values", async () => {
    const schema = v.object({ tags: list(v.string()) });

    const many = await parseForm(
      post([
        ["tags", "tag:a"],
        ["tags", "tag:b"],
      ]),
      schema,
    );
    const one = await parseForm(post([["tags", "tag:a"]]), schema);
    const none = await parseForm(post([]), schema);

    expect(many).toEqual({ ok: true, data: { tags: ["tag:a", "tag:b"] } });
    expect(one).toEqual({ ok: true, data: { tags: ["tag:a"] } });
    expect(none).toEqual({ ok: true, data: { tags: [] } });
  });

  test("keys field errors by name and other errors as form", async () => {
    const schema = v.pipe(
      v.object({ name: v.pipe(v.string(), v.minLength(1, "Enter a name.")), confirm: v.string() }),
      v.check((input) => input.confirm === "yes", "Confirm the change."),
    );

    const field = await parseForm(
      post([
        ["name", ""],
        ["confirm", "yes"],
      ]),
      schema,
    );
    const form = await parseForm(
      post([
        ["name", "nas"],
        ["confirm", "no"],
      ]),
      schema,
    );

    expect(field).toEqual({ ok: false, errors: { name: "Enter a name." } });
    expect(form).toEqual({ ok: false, errors: { form: "Confirm the change." } });
  });
});
