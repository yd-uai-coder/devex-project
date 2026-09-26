// 作成：Phase-3-5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHearingStore } from "../hearing-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

vi.mock("@/features/hearing/api/streamChat", () => ({
  streamChat: vi.fn(),
}));

import { streamChat } from "@/features/hearing/api/streamChat";

async function* fakeStream(deltas: string[]) {
  for (const delta of deltas) yield delta;
}

function resetStore() {
  useHearingStore.setState({
    messages: [],
    historyStatus: "idle",
    sending: false,
    streamingReply: "",
    connectionLost: false,
    completion: null,
    generationTriggered: false,
    projectStatus: null,
  });
}

describe("useHearingStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
    vi.mocked(streamChat).mockReset();
  });

  afterEach(() => {
    stub.restore();
  });

  it("loadHistory()は成功時にmessagesとstatusを更新する", async () => {
    stub.queue({
      status: 200,
      body: [{ id: "1", sender: "user", message: "hi", created_at: "2026-01-01T00:00:00Z" }],
    });
    stub.queue({ status: 200, body: { id: "p1", status: "interviewing" } });
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: [] } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().messages).toHaveLength(1);
    expect(useHearingStore.getState().historyStatus).toBe("success");
  });

  it("loadHistory()はstatus==='interviewing'のとき完了判定を取り直し、"
    + "画面更新・再遷移をまたいでもHearingCompletionBannerが消えないようにする", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "interviewing" } });
    stub.queue({ status: 200, body: { is_sufficient: true, summary: "要約", missing_points: [] } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(false);
    expect(useHearingStore.getState().completion).toEqual({
      is_sufficient: true,
      summary: "要約",
      missing_points: [],
    });
  });

  it("loadHistory()はstatus==='revising'のときも完了判定を取り直す(修正後の再ヒアリングを継続できる)", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "revising" } });
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: ["x"] } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(false);
    expect(useHearingStore.getState().projectStatus).toBe("revising");
    expect(useHearingStore.getState().completion).toEqual({
      is_sufficient: false,
      summary: "",
      missing_points: ["x"],
    });
  });

  it("loadHistory()はstatus==='generating'のときのみgenerationTriggeredを立て、"
    + "無駄な完了判定の再問い合わせをしない", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "generating" } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(true);
    expect(useHearingStore.getState().completion).toBeNull();
    expect(stub.requests).toHaveLength(2); // getChatHistory + getProjectのみ、getHearingCompletionは呼ばない
  });

  it("loadHistory()はstatus==='completed'のときgenerationTriggeredを立てず"
    + "(自動でドキュメント画面へ戻されない)、完了判定の再問い合わせもしない", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "completed" } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(false);
    expect(useHearingStore.getState().projectStatus).toBe("completed");
    expect(useHearingStore.getState().completion).toBeNull();
    expect(stub.requests).toHaveLength(2); // getChatHistory + getProjectのみ、getHearingCompletionは呼ばない
  });

  it("sendMessage()はストリームを蓄積してAIメッセージを確定し、完了判定も取得する", async () => {
    vi.mocked(streamChat).mockReturnValue(fakeStream(["こん", "にちは"]));
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: ["x"] } });

    await useHearingStore.getState().sendMessage("p1", "はじめまして");

    const { messages, streamingReply, sending, completion } = useHearingStore.getState();
    expect(messages.map((m) => [m.sender, m.message])).toEqual([
      ["user", "はじめまして"],
      ["ai", "こんにちは"],
    ]);
    expect(streamingReply).toBe("");
    expect(sending).toBe(false);
    expect(completion).toEqual({ is_sufficient: false, summary: "", missing_points: ["x"] });
  });

  it("ストリーム中に例外が発生したらconnectionLostを立て、ユーザー発話は残す", async () => {
    vi.mocked(streamChat).mockImplementation(async function* () {
      throw new Error("network error");
    });

    await useHearingStore.getState().sendMessage("p1", "こんにちは");

    const { sending, connectionLost, streamingReply, messages } = useHearingStore.getState();
    expect(sending).toBe(false);
    expect(connectionLost).toBe(true);
    expect(streamingReply).toBe("");
    // ユーザー発話はサーバー側で既に永続化されている前提のため、ローカル表示は残す
    expect(messages.map((m) => m.sender)).toEqual(["user"]);
  });

  it("approveAndGenerate()はtriggerGenerationを呼びgenerationTriggeredを立てる", async () => {
    stub.queue({ status: 202, body: null });

    await useHearingStore.getState().approveAndGenerate("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(true);
    expect(stub.requests[0].url).toContain("/generate");
  });

  it("dismissConnectionLost()はconnectionLostをfalseに戻す", () => {
    useHearingStore.setState({ connectionLost: true });

    useHearingStore.getState().dismissConnectionLost();

    expect(useHearingStore.getState().connectionLost).toBe(false);
  });
});
