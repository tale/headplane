import { setTimeout as sleep } from "node:timers/promises";

export interface WaitOptions {
  timeout?: number;
  interval?: number;
}

// Retries until `check` returns without throwing, then returns its value.
export async function waitFor<T>(
  description: string,
  check: () => T | Promise<T>,
  { timeout = 30_000, interval = 250 }: WaitOptions = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
    }

    await sleep(interval);
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out after ${timeout}ms waiting for ${description}: ${reason}`);
}
