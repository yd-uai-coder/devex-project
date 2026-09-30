// 作成：Phase-11-4
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUmlGenerationPolling } from "../useUmlGenerationPolling";
import { useUmlStore } from "@/features/uml/uml-store";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/hooks/useGenerationPolling";

describe("useUmlGenerationPolling", () => {
  const refresh = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset().mockResolvedValue(undefined);
    useUmlStore.setState({ refresh });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("active でなければ取り直さない", async () => {
    renderHook(() => useUmlGenerationPolling("p1", false));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("active の間は間隔ごとに refresh(projectId) を呼ぶ", async () => {
    renderHook(() => useUmlGenerationPolling("p1", true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith("p1");
  });

  it("打ち切り時間を過ぎたら止め、resetTimeout で再開する", async () => {
    const { result } = renderHook(() => useUmlGenerationPolling("p1", true));

    // 1間隔ずつ進め、間隔ごとにレンダーを反映させる(実際のブラウザと同じ進み方)
    for (let t = 0; t < POLL_TIMEOUT_MS + POLL_INTERVAL_MS * 2; t += POLL_INTERVAL_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });
    }
    expect(result.current.timedOut).toBe(true);
    const callsAtTimeout = refresh.mock.calls.length;
    expect(callsAtTimeout).toBe(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

    act(() => result.current.resetTimeout());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.timedOut).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(callsAtTimeout + 1);
  });
});
