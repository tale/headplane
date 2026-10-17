import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onTestFinished } from "vitest";

export async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "headplane-test-"));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

export async function tempFile(name: string, content: string) {
  const path = join(await tempDir(), name);
  await writeFile(path, content);
  return path;
}
