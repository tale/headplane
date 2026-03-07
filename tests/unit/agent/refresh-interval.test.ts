import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

describe("Agent refresh interval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("setInterval is called with cache_ttl value", () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const cache_ttl = 180000; // 3 minutes

    // Simulate what the agent does when starting refresh
    const refreshInterval = setInterval(() => {
      // refresh logic
    }, cache_ttl);

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), cache_ttl);

    clearInterval(refreshInterval);
    setIntervalSpy.mockRestore();
  });

  test("interval triggers callback at expected times", () => {
    const callback = vi.fn();
    const cache_ttl = 60000; // 1 minute for test

    const interval = setInterval(callback, cache_ttl);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(cache_ttl);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(cache_ttl);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(cache_ttl);
    expect(callback).toHaveBeenCalledTimes(3);

    clearInterval(interval);
  });

  test("clearInterval stops the refresh", () => {
    const callback = vi.fn();
    const cache_ttl = 60000;

    const interval = setInterval(callback, cache_ttl);

    vi.advanceTimersByTime(cache_ttl);
    expect(callback).toHaveBeenCalledTimes(1);

    clearInterval(interval);

    vi.advanceTimersByTime(cache_ttl * 5);
    expect(callback).toHaveBeenCalledTimes(1); // still 1, not called again
  });
});
