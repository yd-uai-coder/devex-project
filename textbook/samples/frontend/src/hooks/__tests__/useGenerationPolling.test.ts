// 作成：Phase-3-6
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGenerationPolling } from "../useGenerationPolling";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("useGenerationPolling", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
    vi.useRealTimers();
  });

  it("active=falseの間はポーリングしない", () => {
    vi.useFakeTimers();
    const onCompleted = vi.fn();
    renderHook(() => useGenerationPolling("p1", false, onCompleted));

    vi.advanceTimersByTime(20000);

    expect(stub.requests).toHaveLength(0);
  });

  it("active=trueなら5秒ごとにGET /projects/{id}を呼び、completedでonCompletedを呼ぶ", async () => {
    stub.queue({
      status: 200,
      body: { id: "p1", title: "t", status: "generating", created_at: "", updated_at: "" },
    });
    stub.queue({
      status: 200,
      body: { id: "p1", title: "t", status: "completed", created_at: "", updated_at: "" },
    });
    vi.useFakeTimers();
    const onCompleted = vi.fn();
    renderHook(() => useGenerationPolling("p1", true, onCompleted));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(stub.requests).toHaveLength(1);
    expect(onCompleted).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(stub.requests).toHaveLength(2);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("3分経過してもcompletedにならなければtimedOut=trueになりポーリングを止める", async () => {
    for (let i = 0; i < 40; i += 1) {
      stub.queue({
        status: 200,
        body: { id: "p1", title: "t", status: "generating", created_at: "", updated_at: "" },
      });
    }
    vi.useFakeTimers();
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useGenerationPolling("p1", true, onCompleted));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    });

    expect(result.current.timedOut).toBe(true);
    const requestCountAtTimeout = stub.requests.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(stub.requests).toHaveLength(requestCountAtTimeout);
  });
});
