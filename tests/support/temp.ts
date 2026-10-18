import { rmSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onTestFinished } from "vitest";

// Removed when the test finishes, or when the worker exits if it was made in
// a hook rather than a test.
export async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "headplane-test-"));
  try {
    onTestFinished(() => rm(dir, { recursive: true, force: true }));
  } catch {
    process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
  }

  return dir;
}

export async function tempFile(name: string, content: string) {
  const path = join(await tempDir(), name);
  await writeFile(path, content);
  return path;
}
