import {
  DynamicCodeBlock as Base,
  type DynamicCodeblockProps,
} from "fumadocs-ui/components/dynamic-codeblock";

// A code block built from a string, for code that interpolates values like
// `versions`. Matches the static blocks' themes and styling.
export default function DynamicCodeBlock(props: DynamicCodeblockProps) {
  return (
    <Base
      codeblock={{ className: "border-line bg-subtle my-5 rounded-lg" }}
      options={{ themes: { light: "github-light", dark: "github-dark" } }}
      {...props}
    />
  );
}
