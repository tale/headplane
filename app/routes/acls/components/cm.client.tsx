import * as shopify from "@shopify/lang-jsonc";
import CodeMirror, { EditorSelection, EditorView } from "@uiw/react-codemirror";
import { BookCopy, CircleX } from "lucide-react";
import { useEffect, useRef } from "react";
import Merge from "react-codemirror-merge";
import { ErrorBoundary } from "react-error-boundary";

import { headplaneTheme } from "./theme";

interface EditorProps {
  isDisabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Character range to reveal and select, e.g. the rule the map jumped from. */
  highlight?: { start: number; end: number } | undefined;
  /**
   * Identifies the jump, not the range. The range is rescanned from the live
   * buffer on every keystroke, so keying off it would re-impose the selection
   * while you type.
   */
  highlightKey?: string;
}

export function Editor(props: EditorProps) {
  const viewRef = useRef<EditorView | null>(null);
  // Read at apply time rather than captured by the effect, so applying once
  // still uses the current range.
  const highlightRef = useRef(props.highlight);
  highlightRef.current = props.highlight;
  const appliedRef = useRef<string | undefined>(undefined);

  // Revealing is a ONE-SHOT action per jump. It used to re-run whenever the
  // computed range changed, which meant every edit re-selected and refocused
  // mid-keystroke — deleting the highlighted token would fight the controlled
  // value sync and appear to paste text back in.
  const applyOnce = (view: EditorView) => {
    if (appliedRef.current === props.highlightKey) return;
    appliedRef.current = props.highlightKey;
    reveal(view, highlightRef.current);
  };

  // Applied from two places because the order is not guaranteed: switching
  // tabs remounts the editor, so the view may only exist by the time
  // onCreateEditor fires — but on a second jump the view is already there and
  // only this effect runs.
  useEffect(() => {
    if (viewRef.current) applyOnce(viewRef.current);
  }, [props.highlightKey]);

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
          onCreateEditor={(view) => {
            viewRef.current = view;
            applyOnce(view);
          }}
          readOnly={props.isDisabled}
          theme={headplaneTheme}
          value={props.value}
        />
      </ErrorBoundary>
    </div>
  );
}

/**
 * Select a range and scroll it into view. Positions come from a scan of the
 * live editor buffer, but the document can still have moved on, so anything
 * out of bounds is ignored rather than throwing inside a dispatch.
 */
function reveal(view: EditorView, at?: { start: number; end: number }): void {
  if (!at) return;
  const { start, end } = at;
  if (start < 0 || end > view.state.doc.length || end <= start) return;

  const range = EditorSelection.range(start, end);
  view.dispatch({
    selection: range,
    effects: EditorView.scrollIntoView(range, { y: "center" }),
  });
  view.focus();
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
