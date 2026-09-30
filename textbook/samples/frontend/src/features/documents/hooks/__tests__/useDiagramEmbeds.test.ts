// 作成：Phase-13-6
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDiagramEmbeds } from "../useDiagramEmbeds";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { makeEmbed } from "@/features/uml/test-utils/umlFixtures";

describe("useDiagramEmbeds", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("enabled のときだけ GET .../uml/embeds を呼ぶ", async () => {
    renderHook(() => useDiagramEmbeds("p1", false));
    expect(stub.requests).toHaveLength(0);

    stub.queue({ body: [makeEmbed()] });
    const { result } = renderHook(() => useDiagramEmbeds("p1", true));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(stub.requests[0].url).toMatch(/\/projects\/p1\/uml\/embeds$/);
    expect(result.current.embeds).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("取得に失敗したら error を持ち、loaded にする", async () => {
    stub.queue({ status: 500, body: { detail: "失敗", code: "INTERNAL" } });

    const { result } = renderHook(() => useDiagramEmbeds("p1", true));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe("失敗");
  });
});
