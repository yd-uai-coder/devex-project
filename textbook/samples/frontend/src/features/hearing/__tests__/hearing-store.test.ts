// 作成：Phase-3-5｜更新：Phase-6-6,15-8,24(完了後の調整),34-3,35-3,35(完了後の調整),69-3
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Phase-35(完了後の調整):追記 ── CONTINUE_OPTIONAL_MESSAGE
import { CONTINUE_OPTIONAL_MESSAGE, useHearingStore } from "../hearing-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// Phase-15-8：更新(StreamChatError は本物を使う。ストアが instanceof で見分けるため)
// vi.mock("@/features/hearing/api/streamChat", () => ({
//   streamChat: vi.fn(),
// }));
// ↓↓
vi.mock("@/features/hearing/api/streamChat", async () => {
  const actual = await vi.importActual<typeof import("@/features/hearing/api/streamChat")>(
    "@/features/hearing/api/streamChat",
  );
  return { ...actual, streamChat: vi.fn() };
});

// Phase-15-8:追記 ── StreamChatError
import { streamChat, StreamChatError } from "@/features/hearing/api/streamChat";
// Phase-35-3:追記
import type { ChatStreamEvent } from "@/features/hearing/api/streamChat";
import type { HearingCard } from "@/features/hearing/api/hearingApi";

// Phase-35-3：更新
// async function* fakeStream(deltas: string[]) {
//   for (const delta of deltas) yield delta;
// ↓↓
async function* fakeStream(deltas: string[], cards: HearingCard[] = []): AsyncGenerator<ChatStreamEvent> {
  for (const delta of deltas) yield { kind: "delta", delta };
  if (cards.length > 0) yield { kind: "cards", cards };
}

function card(id: string, label: string, selected: number | null = null): HearingCard {
  return {
    id,
    point_key: id,
    label,
    question: `${label}の問い`,
    options: [
      { label: `${label}A`, result: "a" },
      { label: `${label}B`, result: "b" },
    ],
    recommended: 0,
    reason: "",
    selected,
  };
}

function resetStore() {
  useHearingStore.setState({
    // Phase-24:追記
    projectId: null,
    messages: [],
    historyStatus: "idle",
    sending: false,
    streamingReply: "",
    connectionLost: false,
    // Phase-15-8:追記
    streamError: null,
    completion: null,
    // Phase-34-3:追記
    points: null,
    // Phase-35-3:追記
    cardDrafts: {},
    generationTriggered: false,
    projectStatus: null,
  });
}

// Phase-34-3:追記
const POINTS_VIEW = {
  scale: null,
  legacy: false,
  stale: false,
  is_sufficient: false,
  points: [
    {
      key: "scale",
      kind: "function",
      label: "規模",
      question: "使うのは誰ですか",
      required: true,
      status: "open",
      summary: "",
      evidence: [],
    },
  ],
};

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
  // Phase-24:追記
  });

  it("loadHistory()は別のプロジェクトを開くと、前の会話と完了判定を捨ててから読む", async () => {
    useHearingStore.setState({
      projectId: "p1",
      messages: [{ id: "1", sender: "user", message: "hi", created_at: "2026-01-01T00:00:00Z" }],
      completion: { is_sufficient: true, summary: "前のプロジェクト", missing_points: [] },
    });
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p2", status: "completed" } });

    const pending = useHearingStore.getState().loadHistory("p2");
    expect(useHearingStore.getState().messages).toEqual([]);
    expect(useHearingStore.getState().completion).toBeNull();
    await pending;

    expect(useHearingStore.getState().projectId).toBe("p2");
    expect(useHearingStore.getState().completion).toBeNull();
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
    // Phase-34-3：更新
    // expect(stub.requests).toHaveLength(2); // getChatHistory + getProjectのみ、getHearingCompletionは呼ばない
    // ↓↓
    // getChatHistory + getProject + 観点の表のみ、getHearingCompletionは呼ばない
    expect(stub.requests.map((r) => r.url.split("/").pop())).toEqual(["chat", "p1", "hearing-points"]);
  });

  it("loadHistory()はstatus==='completed'のときgenerationTriggeredを立てず"
    + "(自動でドキュメント画面へ戻されない)、完了判定の再問い合わせもしない", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "completed" } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(false);
    expect(useHearingStore.getState().projectStatus).toBe("completed");
    expect(useHearingStore.getState().completion).toBeNull();
    // Phase-34-3：更新
    // expect(stub.requests).toHaveLength(2); // getChatHistory + getProjectのみ、getHearingCompletionは呼ばない
    // ↓↓
    // getChatHistory + getProject + 観点の表のみ、getHearingCompletionは呼ばない
    expect(stub.requests.map((r) => r.url.split("/").pop())).toEqual(["chat", "p1", "hearing-points"]);
  });

  it("loadHistory()は完了判定の後に観点の表を取り、storeに置く", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "interviewing" } });
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: [] } });
    stub.queue({ status: 200, body: POINTS_VIEW });

    await useHearingStore.getState().loadHistory("p1");

    expect(stub.requests[3].url).toContain("/api/v1/projects/p1/hearing-points");
    expect(useHearingStore.getState().points).toEqual(POINTS_VIEW);
  });

  it("観点の表の取得に失敗しても、チャットの読み込みは成功のまま", async () => {
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "completed" } });
    stub.queue({ status: 500, body: { error: { code: "X", message: "失敗" } } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState().historyStatus).toBe("success");
    expect(useHearingStore.getState().points).toBeNull();
  });

  it("sendMessage()は返信の後に完了判定と観点の表を取り直す", async () => {
    useHearingStore.setState({ projectId: "p1" });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["了解"]));
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: ["規模"] } });
    stub.queue({ status: 200, body: POINTS_VIEW });

    await useHearingStore.getState().sendMessage("p1", "個人で使います");

    expect(stub.requests.map((r) => r.url.split("/").pop())).toEqual(["hearing-completion", "hearing-points"]);
    expect(useHearingStore.getState().points).toEqual(POINTS_VIEW);
  });

  it("別のプロジェクトへ移った後に届いた観点の表は置かない", async () => {
    useHearingStore.setState({ projectId: "p2" });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["了解"]));
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: [] } });
    stub.queue({ status: 200, body: POINTS_VIEW });

    await useHearingStore.getState().sendMessage("p1", "個人で使います");

    expect(useHearingStore.getState().points).toBeNull();
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
    // Phase-15-8：更新(発話はストリームの最後に保存されるため、元のコメントの前提は誤りだった)
    // // ユーザー発話はサーバー側で既に永続化されている前提のため、ローカル表示は残す
    // ↓↓
    // 接続の切断では発話が保存されたかどうか分からないため、ローカル表示は残す
    expect(messages.map((m) => m.sender)).toEqual(["user"]);
  });

  // Phase-15-8:追記
  it("バックエンドがevent: errorで失敗を伝えたら、発話の表示を取り消して理由を見せる", async () => {
    vi.mocked(streamChat).mockImplementation(async function* () {
      throw new StreamChatError("本日の利用上限に達しました。", "LLM_QUOTA_EXCEEDED");
    });

    await useHearingStore.getState().sendMessage("p1", "こんにちは");

    const { sending, connectionLost, streamError, messages } = useHearingStore.getState();
    expect(sending).toBe(false);
    expect(connectionLost).toBe(false);
    expect(streamError).toBe("本日の利用上限に達しました。");
    expect(messages).toEqual([]);

    useHearingStore.getState().dismissConnectionLost();
    expect(useHearingStore.getState().streamError).toBeNull();
  });

  // Phase-35-3:追記
  it("返信に付いたカードを、確定したAIの発言に持たせる", async () => {
    vi.mocked(streamChat).mockReturnValue(fakeStream(["教えてください"], [card("scale", "規模")]));

    await useHearingStore.getState().sendMessage("p1", "はじめまして");

    const ai = useHearingStore.getState().messages[1];
    expect(ai.cards?.map((c) => c.id)).toEqual(["scale"]);
  });

  // Phase-35(完了後の調整)：更新(ラジオボタンなので外さない)
  // it("selectCardOption()は選択を置き、同じ選択肢をもう一度選ぶと外す", () => {
  //   const { selectCardOption } = useHearingStore.getState();
  //
  //   selectCardOption("c1", 1);
  //   selectCardOption("c2", 0);
  //   selectCardOption("c2", 0);
  //
  //   expect(useHearingStore.getState().cardDrafts).toEqual({ c1: 1 });
  // });
  // ↓↓
  it("selectCardOption()は選択を置き、選び直すと置き換える(ラジオボタンなので外さない)", () => {
    const { selectCardOption } = useHearingStore.getState();

    selectCardOption("c1", 1);
    selectCardOption("c2", 0);
    selectCardOption("c2", 0);
    selectCardOption("c1", 0);

    expect(useHearingStore.getState().cardDrafts).toEqual({ c1: 0, c2: 0 });
  });

  it("sendMessage()は最新のAIの発言のカードの選択を送り、選んだ内容と文を1つの発言として表示する", async () => {
    useHearingStore.setState({
      messages: [
        { id: "a1", sender: "ai", message: "古い", cards: [card("old", "古い")], created_at: "" },
        {
          id: "a2",
          sender: "ai",
          message: "質問",
          cards: [card("avail", "可用性"), card("sec", "セキュリティ"), card("done", "済み", 0)],
          created_at: "",
        },
      ],
      cardDrafts: { sec: 0, avail: 1, old: 0 },
    });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["了解"]));

    await useHearingStore.getState().sendMessage("p1", "補足");

    expect(streamChat).toHaveBeenCalledWith("p1", "補足", {
      cardAnswers: [
        { card_id: "avail", option: 1 },
        { card_id: "sec", option: 0 },
      ],
    });
    const { messages, cardDrafts } = useHearingStore.getState();
    expect(messages[2].message).toBe("【可用性】可用性B\n【セキュリティ】セキュリティA\n\n補足");
    expect(messages[1].cards?.map((c) => c.selected)).toEqual([1, 0, 0]);
    expect(messages[0].cards?.[0].selected).toBeNull();
    expect(cardDrafts).toEqual({});
  });

  // Phase-35(完了後の調整):追記
  it("sendMessage()にcardIdsを渡すと、そのカードの回答だけを送り、選択中はすべて捨てる", async () => {
    useHearingStore.setState({
      messages: [
        {
          id: "a1",
          sender: "ai",
          message: "質問",
          cards: [card("avail", "可用性"), card("sec", "セキュリティ")],
          created_at: "",
        },
      ],
      cardDrafts: { avail: 1, sec: 0 },
    });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["了解"]));

    await useHearingStore.getState().sendMessage("p1", "", { cardIds: ["sec"] });

    expect(streamChat).toHaveBeenCalledWith("p1", "", { cardAnswers: [{ card_id: "sec", option: 0 }] });
    const { messages, cardDrafts } = useHearingStore.getState();
    expect(messages[1].message).toBe("【セキュリティ】セキュリティA");
    expect(messages[0].cards?.map((c) => c.selected)).toEqual([null, 0]);
    expect(cardDrafts).toEqual({});
  });

  // Phase-35(完了後の調整):追記
  it("sendMessage()にcontinueOptionalを渡すと、streamChatへそのまま渡す", async () => {
    vi.mocked(streamChat).mockReturnValue(fakeStream(["任意の点を伺います"]));

    await useHearingStore.getState().sendMessage("p1", "続けて", { continueOptional: true });

    expect(streamChat).toHaveBeenCalledWith("p1", "続けて", { cardAnswers: [], continueOptional: true });
  });

  // Phase-35(完了後の調整):追記
  it("「任意を続ける」だけの送信は、サーバーが残す決まった文を楽観表示する", async () => {
    vi.mocked(streamChat).mockReturnValue(fakeStream(["任意の点を伺います"]));

    await useHearingStore.getState().sendMessage("p1", "", { continueOptional: true });

    expect(useHearingStore.getState().messages[0].message).toBe(CONTINUE_OPTIONAL_MESSAGE);
  });

  it("skipPoint()は観点を対象外にして表を置き、完了判定を取り直す", async () => {
    useHearingStore.setState({ projectId: "p1" });
    stub.queue({ status: 200, body: { ...POINTS_VIEW, is_sufficient: true } });
    stub.queue({ status: 200, body: { is_sufficient: true, summary: "- 規模: 個人・小規模", missing_points: [] } });

    await useHearingStore.getState().skipPoint("p1", "purpose");

    expect(stub.requests[0].url).toMatch(/\/hearing-points\/purpose$/);
    expect(stub.requests[0].init?.method).toBe("PUT");
    expect(useHearingStore.getState().points?.is_sufficient).toBe(true);
    expect(useHearingStore.getState().completion?.is_sufficient).toBe(true);
  });

  it("バックエンドが失敗を伝えたら、カードの選択も送信の前に戻す", async () => {
    const before = [
      { id: "a1", sender: "ai" as const, message: "質問", cards: [card("avail", "可用性")], created_at: "" },
    ];
    useHearingStore.setState({ messages: before, cardDrafts: { avail: 0 } });
    vi.mocked(streamChat).mockImplementation(async function* () {
      throw new StreamChatError("古いカードです", "INVALID_CARD_ANSWER");
    });

    await useHearingStore.getState().sendMessage("p1", "");

    const { messages, cardDrafts, streamError } = useHearingStore.getState();
    expect(messages).toEqual(before);
    expect(cardDrafts).toEqual({ avail: 0 });
    expect(streamError).toBe("古いカードです");
  });

  it("approveAndGenerate()はtriggerGenerationを呼びgenerationTriggeredを立てる", async () => {
    stub.queue({ status: 202, body: null });

    await useHearingStore.getState().approveAndGenerate("p1");

    expect(useHearingStore.getState().generationTriggered).toBe(true);
    expect(stub.requests[0].url).toContain("/generate");
  });

  // Phase-6-6:追記
  // Phase-69-3:追記
  it("loadHistory()は直近の生成の失敗を持ち(生成の前に戻った状態で、もう一度生成できる)、"
    + "approveAndGenerate()で消す", async () => {
    const failure = {
      reason_code: "GENERATION_FAILED",
      message: "設計書の生成に失敗しました。時間をおいて再度お試しください。",
      targets: ["requirements"],
      failed_at: "2026-10-17T06:00:00Z",
    };
    stub.queue({ status: 200, body: [] });
    stub.queue({ status: 200, body: { id: "p1", status: "interviewing", generation_failure: failure } });
    stub.queue({ status: 200, body: { is_sufficient: true, summary: "要約", missing_points: [] } });

    await useHearingStore.getState().loadHistory("p1");

    expect(useHearingStore.getState()).toMatchObject({ generationFailure: failure, generationTriggered: false });
    expect(useHearingStore.getState().completion?.is_sufficient).toBe(true);
    stub.queue({ status: 202, body: null });
    await useHearingStore.getState().approveAndGenerate("p1");
    expect(useHearingStore.getState().generationFailure).toBeNull();
  });

  it("approveAndGenerate()は使用済みの完了判定を破棄し、projectStatusをgeneratingにする", async () => {
    useHearingStore.setState({
      projectStatus: "interviewing",
      completion: { is_sufficient: true, summary: "要約", missing_points: [] },
    });
    stub.queue({ status: 202, body: null });

    await useHearingStore.getState().approveAndGenerate("p1");

    expect(useHearingStore.getState().projectStatus).toBe("generating");
    expect(useHearingStore.getState().completion).toBeNull();
  });

  // Phase-6-6:追記 ── 生成済み(completed)のプロジェクトへ再度チャットするとサーバー側がrevisingへ
  // 遷移させる。storeのprojectStatusも追従しないと、新しい完了バナーのボタンが押せないままになる。
  it("sendMessage()はprojectStatus==='completed'のときrevisingへ遷移させる", async () => {
    useHearingStore.setState({ projectStatus: "completed" });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["はい"]));
    stub.queue({ status: 200, body: { is_sufficient: true, summary: "要約", missing_points: [] } });

    await useHearingStore.getState().sendMessage("p1", "追加の要望です");

    expect(useHearingStore.getState().projectStatus).toBe("revising");
    expect(useHearingStore.getState().completion?.is_sufficient).toBe(true);
  });

  // Phase-6-6:追記
  it("sendMessage()はcompleted以外のprojectStatusを変更しない", async () => {
    useHearingStore.setState({ projectStatus: "interviewing" });
    vi.mocked(streamChat).mockReturnValue(fakeStream(["はい"]));
    stub.queue({ status: 200, body: { is_sufficient: false, summary: "", missing_points: [] } });

    await useHearingStore.getState().sendMessage("p1", "こんにちは");

    expect(useHearingStore.getState().projectStatus).toBe("interviewing");
  });

  it("dismissConnectionLost()はconnectionLostをfalseに戻す", () => {
    useHearingStore.setState({ connectionLost: true });

    useHearingStore.getState().dismissConnectionLost();

    expect(useHearingStore.getState().connectionLost).toBe(false);
  });
});
