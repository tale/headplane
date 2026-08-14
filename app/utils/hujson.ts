// Headscale and Tailscale policies are HuJSON: JSON plus comments and trailing
// commas.
//
// node-info.ts has its own copy of this for the tag autocomplete. Merging the
// two would mean editing a file the machines pages depend on for no reason
// other than tidiness, so the duplication stays.

/**
 * Strip comments and trailing commas so `JSON.parse` will accept the text.
 *
 * String-aware, which is the whole reason this is a scanner rather than a pair
 * of regexes: a policy is full of values like `"tag:web"` and `"10.0.0.0/8"`,
 * and a naive strip would treat `//` inside a URL or a comma before a closing
 * quote as syntax. Comments are removed rather than blanked, except for the
 * newline that ends a line comment, which is kept so line structure survives.
 */
export function stripHuJSON(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    output += char;
  }

  // Safe only after the scan above has removed anything inside a string from
  // consideration — by here every remaining comma is structural.
  return output.replace(/,\s*([}\]])/g, "$1");
}
