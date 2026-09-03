import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import * as shopify from "@shopify/lang-jsonc";
import CodeMirror from "@uiw/react-codemirror";
import { BookCopy, Braces, CircleCheck, CircleX } from "lucide-react";
import Merge from "react-codemirror-merge";
import { ErrorBoundary } from "react-error-boundary";

import Button from "~/components/button";
import { formatPolicy, validatePolicy } from "~/utils/acl-policy";

import { headplaneTheme } from "./theme";

interface EditorProps {
  isDisabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function Editor(props: EditorProps) {
  const diagnostics = validatePolicy(props.value);
  const firstError = diagnostics[0];

  return (
    <div className="text-sm">
      <ErrorBoundary
        fallback={
          <div className="flex flex-col items-center gap-2.5 py-8">
            <CircleX />
            <p className="text-lg font-semibold">Failed to load the editor.</p>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--cm-gutter-border)] bg-[var(--cm-bg)] px-3 py-2 text-[var(--cm-fg)]">
          <div
            role="status"
            className={
              firstError
                ? "flex min-w-0 items-center gap-2 text-red-600 dark:text-red-400"
                : "flex items-center gap-2 text-green-700 dark:text-green-400"
            }
          >
            {firstError ? (
              <CircleX className="size-4 shrink-0" />
            ) : (
              <CircleCheck className="size-4 shrink-0" />
            )}
            <span className="truncate">
              {firstError ? firstError.message : "Valid HuJSON syntax"}
            </span>
          </div>
          <Button
            disabled={props.isDisabled || firstError !== undefined}
            onClick={() => {
              const result = formatPolicy(props.value);
              if (result.ok) props.onChange(result.value);
            }}
            type="button"
          >
            <Braces className="size-4" />
            Format
          </Button>
        </div>
        <CodeMirror
          editable={!props.isDisabled}
          extensions={[shopify.jsonc(), policyLinter, lintGutter()]}
          minHeight="24rem"
          maxHeight="var(--height-editor)"
          onChange={(value) => props.onChange(value)}
          readOnly={props.isDisabled}
          theme={headplaneTheme}
          value={props.value}
        />
      </ErrorBoundary>
    </div>
  );
}

const policyLinter = linter((view): Diagnostic[] =>
  validatePolicy(view.state.doc.toString()).map((diagnostic) => ({
    ...diagnostic,
    severity: "error",
    source: "HuJSON",
  })),
);

interface DifferProps {
  left: string;
  right: string;
}

export function Differ(props: DifferProps) {
  return (
    <div className="text-sm">
      {props.left === props.right ? (
        <div className="flex flex-col items-center gap-2.5 py-8">
          <BookCopy />
          <p className="text-lg font-semibold">No changes</p>
        </div>
      ) : (
        <div className="h-editor">
          <ErrorBoundary
            fallback={
              <div className="flex flex-col items-center gap-2.5 py-8">
                <CircleX />
                <p className="text-lg font-semibold">Failed to load the editor.</p>
              </div>
            }
          >
            <Merge orientation="a-b" theme={headplaneTheme}>
              <Merge.Original extensions={[shopify.jsonc()]} readOnly value={props.left} />
              <Merge.Modified extensions={[shopify.jsonc()]} readOnly value={props.right} />
            </Merge>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
