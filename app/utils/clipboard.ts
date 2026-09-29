/**
 * Copies text to the clipboard, returning whether the copy succeeded.
 *
 * `navigator.clipboard` only exists in secure contexts (HTTPS or
 * `localhost`), which self-hosted Headplane instances often aren't served
 * over. When it's unavailable, or the async clipboard write fails, this
 * falls back to the legacy `document.execCommand("copy")` approach instead
 * of throwing.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
