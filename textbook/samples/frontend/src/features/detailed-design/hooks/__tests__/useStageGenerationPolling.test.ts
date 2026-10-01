// 作成：Phase-16-6
// 写経レベル: 定型 ── ポーリングの間隔と打ち切り。
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStageGenerationPolling } from "../useStageGenerationPolling";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/hooks/useGenerationPolling";

describe("useStageGenerationPolling", () => {
  const fetchStages = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchStages.mockReset().mockResolvedValue(undefined);
    useDetailedDesignStore.setState({ fetchStages });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("active でなければ取り直さない", async () => {
    renderHook(() => useStageGenerationPolling("p1", false));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(fetchStages).not.toHaveBeenCalled();
  });

  it("active の間は間隔ごとに fetchStages(projectId) を呼び、打ち切り時間で止める", async () => {
    const { result } = renderHook(() => useStageGenerationPolling("p1", true));

    for (let t = 0; t < POLL_TIMEOUT_MS + POLL_INTERVAL_MS * 2; t += POLL_INTERVAL_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });
    }

    expect(fetchStages).toHaveBeenCalledWith("p1");
    expect(fetchStages).toHaveBeenCalledTimes(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);
    expect(result.current.timedOut).toBe(true);
  });
});
