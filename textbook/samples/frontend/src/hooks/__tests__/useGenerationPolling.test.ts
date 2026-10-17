// 作成：Phase-3-6｜更新：Phase-69-3
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

  // Phase-69-3:追記
  it("失敗して前の状態(revising)に戻ったら、読んだプロジェクト(失敗の記録つき)を渡して止める", async () => {
    const failure = { reason_code: "GENERATION_FAILED", message: "失敗", targets: ["requirements"], failed_at: "2026-10-17T00:00:00Z" };
    stub.queue({
      status: 200,
      body: { id: "p1", title: "t", status: "revising", generation_failure: failure, created_at: "", updated_at: "" },
    });
    vi.useFakeTimers();
    const onFinished = vi.fn();
    renderHook(() => useGenerationPolling("p1", true, onFinished));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0][0].generation_failure).toEqual(failure);
  });

  it("プロジェクトを一時的に読めなくても、次の回に読み直す", async () => {
    stub.queue({ status: 500, body: { detail: "down" } });
    stub.queue({
      status: 200,
      body: { id: "p1", title: "t", status: "completed", created_at: "", updated_at: "" },
    });
    vi.useFakeTimers();
    const onFinished = vi.fn();
    renderHook(() => useGenerationPolling("p1", true, onFinished));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(stub.requests).toHaveLength(2);
    expect(onFinished).toHaveBeenCalledTimes(1);
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
