// Source positions for ACL rules, so the UI can jump from a rule back to the
// text that declares it.
//
// The parser throws positions away (it strips HuJSON, then JSON.parses), so
// this walks the RAW text instead. It must therefore understand strings and
// comments itself — a "}" inside a string or a "," inside a comment would
// otherwise end an element early.

export interface RuleRange {
  /** Matches AclRule.index — position in the source array, skipped rules included. */
  index: number;
  /** Offsets into the original text, suitable for a CodeMirror selection. */
  start: number;
  end: number;
}

/**
 * Offsets of every element of the top-level `acls` array. Returns an empty
 * array when the policy has no `acls`, or is too malformed to scan.
 */
/** Sentinel depths for the one `acls` array: not reached yet, and finished. */
const ACLS_UNSEEN = -1;
const ACLS_CLOSED = -2;

export function locateRules(policyText: string): RuleRange[] {
  const ranges: RuleRange[] = [];
  const length = policyText.length;

  let i = 0;
  let depth = 0;
  let aclsDepth = ACLS_UNSEEN;
  let elementStart = -1;
  let lastKey: string | null = null;
  let stringStart = -1;

  while (i < length) {
    const char = policyText[i];
    const next = policyText[i + 1];

    // --- comments ---------------------------------------------------------
    if (char === "/" && next === "/") {
      while (i < length && policyText[i] !== "\n") i++;
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < length && !(policyText[i] === "*" && policyText[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // --- strings ----------------------------------------------------------
    if (char === '"') {
      // A string can itself be the start of an element (a bare dst, say), so
      // record the element before consuming it.
      if (isElementStart(aclsDepth, depth, elementStart)) elementStart = i;
      stringStart = i;
      i++;
      let escaped = false;
      while (i < length) {
        const c = policyText[i];
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') break;
        i++;
      }
      lastKey = policyText.slice(stringStart + 1, i);
      i++;
      continue;
    }

    // An element begins at the first meaningful character after "[" or ",".
    // A closing bracket is not a start — without this the "]" after a trailing
    // comma would open a zero-length element.
    if (
      isElementStart(aclsDepth, depth, elementStart) &&
      !isSpace(char) &&
      char !== "," &&
      char !== "]" &&
      char !== "}"
    ) {
      elementStart = i;
    }

    // --- containers -------------------------------------------------------
    if (char === "{" || char === "[") {
      // `acls` sits at the top level, so the array opens at depth 1. Guarding
      // on that avoids matching an "acls" key nested inside something else.
      if (aclsDepth === ACLS_UNSEEN && char === "[" && lastKey === "acls" && depth === 1) {
        aclsDepth = depth + 1;
        elementStart = -1;
      }
      depth++;
      i++;
      continue;
    }

    if (char === "}" || char === "]") {
      if (char === "]" && depth === aclsDepth) {
        pushRange(ranges, policyText, elementStart, i);
        elementStart = -1;
        aclsDepth = ACLS_CLOSED;
      }
      depth--;
      i++;
      continue;
    }

    if (char === "," && depth === aclsDepth) {
      pushRange(ranges, policyText, elementStart, i);
      elementStart = -1;
      i++;
      continue;
    }

    i++;
  }

  return ranges;
}

/**
 * Narrow a rule's range down to one token inside it — the alias a warning is
 * actually about, rather than the whole block around it.
 *
 * The quoted form is tried first so that a token like `bob` cannot match
 * inside `bobcat`. The bare form is the fallback, because a dst alias such as
 * `tag:web` is written `"tag:web:80"` in the source and never appears quoted
 * on its own. Returns null when the token cannot be found, so callers can fall
 * back to highlighting the rule.
 */
export function locateRuleToken(
  policyText: string,
  rule: RuleRange,
  token: string,
): RuleRange | null {
  if (token.length === 0) return null;
  const haystack = policyText.slice(rule.start, rule.end);

  const quoted = haystack.indexOf(`"${token}"`);
  if (quoted !== -1) {
    const start = rule.start + quoted + 1; // skip the opening quote
    return { index: rule.index, start, end: start + token.length };
  }

  const bare = haystack.indexOf(token);
  if (bare === -1) return null;
  return { index: rule.index, start: rule.start + bare, end: rule.start + bare + token.length };
}

function isElementStart(aclsDepth: number, depth: number, elementStart: number): boolean {
  return aclsDepth > 0 && depth === aclsDepth && elementStart === -1;
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function pushRange(ranges: RuleRange[], text: string, start: number, stop: number): void {
  if (start === -1) return; // empty slot, e.g. the gap left by a trailing comma
  let end = stop;
  while (end > start && isSpace(text[end - 1])) end--;
  if (end <= start) return;
  ranges.push({ index: ranges.length, start, end });
}
