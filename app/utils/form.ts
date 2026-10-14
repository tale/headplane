import { data } from "react-router";
import * as v from "valibot";

// Errors not tied to a field are keyed as `form`.
export type FormErrors = Record<string, string>;
export type ActionResult = { ok: true; message?: string } | { ok: false; errors: FormErrors };
type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FormErrors };

export async function parseForm<S extends v.GenericSchema>(
  request: Request,
  schema: S,
): Promise<ParseResult<v.InferOutput<S>>> {
  const formData = await request.formData();
  const input: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    input[key] = values.length === 1 ? values[0] : values;
  }

  const result = v.safeParse(schema, input);
  if (result.success) {
    return { ok: true, data: result.output };
  }

  return { ok: false, errors: flattenErrors(result.issues) };
}

export function fieldValidator<S extends v.GenericSchema>(schema: S) {
  return (value: unknown) => {
    const result = v.safeParse(schema, value);
    return result.success ? null : result.issues[0].message;
  };
}

export function list(item: v.GenericSchema<string> = v.string()) {
  return v.optional(
    v.pipe(
      v.union([item, v.array(item)]),
      v.transform((value) => (Array.isArray(value) ? value : [value])),
    ),
    (): string[] => [],
  );
}

export function ok(message?: string): ActionResult {
  return { ok: true, message };
}

export function invalid(errors: FormErrors, status = 400) {
  return data<ActionResult>({ ok: false, errors }, { status });
}

function flattenErrors(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): FormErrors {
  const flat = v.flatten(issues);
  const errors: FormErrors = {};

  for (const [key, messages] of Object.entries(flat.nested ?? {})) {
    if (messages?.[0]) {
      errors[key] = messages[0];
    }
  }

  const formMessage = flat.root?.[0] ?? flat.other?.[0];
  if (formMessage) {
    errors.form = formMessage;
  }

  return errors;
}
