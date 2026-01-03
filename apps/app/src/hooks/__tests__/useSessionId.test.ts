import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

describe("useSessionId", () => {
  beforeEach(() => {
    // Reset modules to get a fresh session ID for each test group
    vi.resetModules();
  });

  it("should return a UUID string", async () => {
    const { useSessionId } = await import("../useSessionId");
    const { result } = renderHook(() => useSessionId());

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("string");
    expect(result.current.length).toBeGreaterThan(0);
    // Check it starts with our test prefix from the mock
    expect(result.current).toMatch(/^test-uuid-/);
  });

  it("should return the same ID across multiple hook calls", async () => {
    const { useSessionId } = await import("../useSessionId");
    const { result: result1 } = renderHook(() => useSessionId());
    const { result: result2 } = renderHook(() => useSessionId());

    expect(result1.current).toBe(result2.current);
  });

  it("should return the same ID on re-render", async () => {
    const { useSessionId } = await import("../useSessionId");
    const { result, rerender } = renderHook(() => useSessionId());

    const firstId = result.current;
    rerender();
    const secondId = result.current;

    expect(firstId).toBe(secondId);
  });

  it("should return different ID after module reset (simulating page reload)", async () => {
    // First import
    const { useSessionId: hook1 } = await import("../useSessionId");
    const { result: result1 } = renderHook(() => hook1());
    const firstId = result1.current;

    // Reset modules to simulate page reload
    vi.resetModules();

    // Second import after reset
    const { useSessionId: hook2 } = await import("../useSessionId");
    const { result: result2 } = renderHook(() => hook2());

    expect(result2.current).not.toBe(firstId);
  });
});
