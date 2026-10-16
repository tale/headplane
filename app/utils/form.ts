import { data } from "react-router";
import * as v from "valibot";

// Errors not tied to a field are keyed as `form`.
export type FormErrors = Record<string, string>;
export type ActionResult =
  | { ok: true; message?: string; data?: Record<string, string> }
  | { ok: false; errors: FormErrors };
type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FormErrors };

export function formValues(formData: FormData) {
  const values: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const key of new Set(formData.keys())) {
    const entries = formData.getAll(key);
    values[key] = entries.length === 1 ? entries[0] : entries;
  }

  return values;
}

export function parseValues<S extends v.GenericSchema>(
  schema: S,
  values: unknown,
): ParseResult<v.InferOutput<S>> {
  const result = v.safeParse(schema, values);
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

export function ok(message?: string, data?: Record<string, string>): ActionResult {
  return { ok: true, message, data };
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
