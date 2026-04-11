import * as shopify from "@shopify/lang-jsonc";
import CodeMirror from "@uiw/react-codemirror";
import { BookCopy, CircleX } from "lucide-react";
import Merge from "react-codemirror-merge";
import { ErrorBoundary } from "react-error-boundary";

import { headplaneTheme } from "./theme";

interface EditorProps {
  isDisabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function Editor(props: EditorProps) {
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
        <CodeMirror
          editable={!props.isDisabled}
          extensions={[shopify.jsonc()]}
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
