export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permissions can fail even when the API is available.
  }

  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = "position: fixed; top: 0; left: -9999px;";

  // Keep the temporary field inside any active modal's focus trap.
  const container = activeElement?.closest('[role="dialog"], [role="alertdialog"], dialog');

  try {
    (container ?? document.body).appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) {
      activeElement.focus({ preventScroll: true });
    }
  }
}
