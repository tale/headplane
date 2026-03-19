import { type, type Type } from "arktype";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FormValue = string | number | boolean | null;

interface FormState {
  values: Record<string, FormValue>;
  errors: Record<string, string>;
  modified: Record<string, boolean>;
}

export interface FormFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  errorMessage?: string;
}

interface UseFormOptions<T extends Record<string, unknown>> {
  schema: Type<T>;
  defaultValues?: Partial<Record<keyof T & string, FormValue>>;
  actionData?: unknown;
  validate?: (values: Record<string, FormValue>) => Record<string, string> | undefined;
}

// arktype's Type<T> doesn't expose `.props` in the type system,
// but it exists at runtime. This extracts schema keys safely.
function schemaKeys(schema: Type): string[] {
  const props = (schema as unknown as { props?: { key: string }[] }).props;
  return props?.map((p) => p.key) ?? [];
}

export function useForm<T extends Record<string, unknown>>(options: UseFormOptions<T>) {
  const { schema, actionData, validate } = options;
  const keys = schemaKeys(schema);
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const initialValues = useMemo(() => {
    const values: Record<string, FormValue> = {};
    for (const key of keys) {
      values[key] =
        options.defaultValues && key in options.defaultValues
          ? (options.defaultValues[key as keyof T & string] as FormValue)
          : "";
    }
    return values;
  }, []);

  const [state, setState] = useState<FormState>({
    values: initialValues,
    errors: {},
    modified: {},
  });

  useEffect(() => {
    if (actionData && typeof actionData === "object" && "errors" in actionData) {
      const errors = actionData.errors as Record<string, string>;
      setState((prev) => ({
        ...prev,
        errors: { ...prev.errors, ...errors },
      }));
    }
  }, [actionData]);

  const setValue = useCallback((name: keyof T & string, raw: FormValue) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: raw },
      modified: { ...prev.modified, [name]: true },
    }));
  }, []);

  function validateField(name: string) {
    if (!state.modified[name]) {
      return;
    }

    const errors: Record<string, string> = {};

    // Schema validation
    const result = schema({ ...state.values } as never);
    if (result instanceof type.errors) {
      const fieldProblems = result.flatProblemsByPath[name];
      if (fieldProblems) {
        errors[name] = fieldProblems[0];
      }
    }

    // Cross-field validation
    if (!errors[name]) {
      const customErrors = validateRef.current?.(state.values);
      if (customErrors?.[name]) {
        errors[name] = customErrors[name];
      }
    }

    setState((prev) => ({
      ...prev,
      errors: {
        ...prev.errors,
        [name]: errors[name] ?? "",
      },
    }));
  }

  function field(name: keyof T & string): FormFieldProps {
    const error = state.errors[name];
    return {
      name,
      value: String(state.values[name] ?? ""),
      onChange: (value: string) => setValue(name, value),
      onBlur: () => validateField(name),
      invalid: !!error,
      errorMessage: error || undefined,
    };
  }

  function computeCanSubmit(): boolean {
    const result = schema({ ...state.values } as never);
    if (result instanceof type.errors) {
      return false;
    }

    const customErrors = validateRef.current?.(state.values);
    if (customErrors && Object.values(customErrors).some(Boolean)) {
      return false;
    }

    return true;
  }

  const reset = useCallback(() => {
    setState({
      values: { ...initialValues },
      errors: {},
      modified: {},
    });
  }, [initialValues]);

  return {
    values: state.values,
    errors: state.errors,
    field,
    canSubmit: computeCanSubmit(),
    setValue,
    reset,
  };
}

type ServerValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export async function validateFormData<T extends Record<string, unknown>>(
  request: Request,
  schema: Type<T>,
): Promise<ServerValidationResult<T>> {
  const formData = await request.formData();
  const parsed: Record<string, unknown> = {};

  for (const key of schemaKeys(schema)) {
    const raw = formData.get(key);
    if (raw !== null) {
      parsed[key] = raw.toString();
    }
  }

  const result = schema(parsed as never);
  if (result instanceof type.errors) {
    const errors: Record<string, string> = {};
    for (const [path, problems] of Object.entries(result.flatProblemsByPath)) {
      errors[path] = problems[0];
    }
    return { success: false, errors };
  }

  return { success: true, data: result as T };
}
