import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--cm-bg)",
    color: "var(--cm-fg)",
  },
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    caretColor: "var(--cm-caret)",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  },
  "&.cm-editor .cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--cm-caret)",
  },
  "&.cm-focused .cm-selectionBackground, & .cm-line::selection, & .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection":
    {
      background: "var(--cm-selection) !important",
    },
  "& .cm-selectionMatch": {
    backgroundColor: "var(--cm-selection-match)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--cm-line-highlight)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--cm-gutter-bg)",
    color: "var(--cm-gutter-fg)",
    borderRight: "1px solid var(--cm-gutter-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--cm-line-highlight)",
    color: "var(--cm-gutter-fg-active)",
  },
  ".cm-scroller": {
    scrollbarColor: "var(--cm-gutter-border) transparent",
    scrollbarWidth: "auto",
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: [t.comment, t.quote], color: "var(--cm-comment)" },
  { tag: [t.keyword], color: "var(--cm-keyword)", fontWeight: "bold" },
  { tag: [t.string, t.meta], color: "var(--cm-string)" },
  { tag: [t.typeName, t.typeOperator], color: "var(--cm-type)" },
  { tag: [t.definition(t.variableName)], color: "var(--cm-definition)" },
  { tag: [t.name], color: "var(--cm-name)" },
  { tag: [t.variableName], color: "var(--cm-variable)" },
  { tag: [t.propertyName], color: "var(--cm-property)" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "var(--cm-atom)" },
  { tag: [t.number], color: "var(--cm-number)" },
  { tag: [t.regexp, t.link], color: "var(--cm-link)" },
  { tag: [t.bracket], color: "var(--cm-bracket)" },
]);

export const headplaneTheme = [editorTheme, syntaxHighlighting(highlightStyle)];
