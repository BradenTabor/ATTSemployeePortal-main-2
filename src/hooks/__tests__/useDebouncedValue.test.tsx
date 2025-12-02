import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the latest value after the delay elapses", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: "initial", delay: 200 },
      }
    );

    expect(result.current).toBe("initial");

    rerender({ value: "updated", delay: 200 });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");
  });

  it("cleans up timers between rapid value changes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 100),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ value: "c" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // still not updated because second timer not finished
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe("c");
  });
});

