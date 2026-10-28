import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import * as shopify from "@shopify/lang-jsonc";
import CodeMirror from "@uiw/react-codemirror";
import { BookCopy, Braces, CircleCheck, CircleDashed, CircleX } from "lucide-react";
import Merge from "react-codemirror-merge";
import { ErrorBoundary } from "react-error-boundary";

import Button from "~/components/button";
import { formatPolicy, parsePolicy } from "~/utils/acl-policy";
import cn from "~/utils/cn";

import { headplaneTheme } from "./theme";

interface EditorProps {
  isDisabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function Editor(props: EditorProps) {
  const isEmpty = props.value.trim().length === 0;
  const parsed = parsePolicy(props.value);
  const status = !parsed.ok
    ? { Icon: CircleX, label: parsed.error, className: "text-bad" }
    : isEmpty
      ? { Icon: CircleDashed, label: "No policy yet", className: "text-muted" }
      : { Icon: CircleCheck, label: "Valid HuJSON", className: "text-ok" };

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
        <div className="border-line bg-surface flex items-center justify-between gap-4 border-b px-3 py-2">
          <div role="status" className={cn("flex min-w-0 items-center gap-2", status.className)}>
            <status.Icon className="size-4 shrink-0" />
            <span className="truncate">{status.label}</span>
          </div>
          <Button
            disabled={props.isDisabled || isEmpty || !parsed.ok}
            onClick={() => {
              const result = formatPolicy(props.value);
              if (result.ok) props.onChange(result.value);
            }}
            size="sm"
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

const policyLinter = linter((view): Diagnostic[] => {
  const parsed = parsePolicy(view.state.doc.toString());
  if (parsed.ok) return [];

  return parsed.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    severity: "error",
    source: "HuJSON",
  }));
});

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
