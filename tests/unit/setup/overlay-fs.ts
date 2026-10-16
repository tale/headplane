import { vi } from "vitest";

const fakeFs = new Map<string, string>();
export function createFakeFile(path: string, content: string) {
  fakeFs.set(path, content);
}

export function clearFakeFiles() {
  fakeFs.clear();
}

vi.mock(import("node:fs/promises"), async (importOrig) => {
  const orig = await importOrig();
  return {
    ...orig,
    readFile: ((
      path: Parameters<typeof orig.readFile>[0],
      options?: Parameters<typeof orig.readFile>[1],
    ) => {
      const p = path.toString();
      if (fakeFs.has(p)) {
        const content = fakeFs.get(p)!;
        if (typeof options === "string" || options?.encoding) {
          return Promise.resolve(content);
        }

        return Promise.resolve(Buffer.from(content));
      }

      return orig.readFile.call(this, path, options ?? null);
    }) as typeof orig.readFile,

    access: (path, mode) => {
      const p = path.toString();
      if (fakeFs.has(p)) {
        return Promise.resolve();
      }

      return orig.access.call(this, path, mode);
    },
  };
});
