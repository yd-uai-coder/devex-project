// 作成：Phase-3-5｜更新：Phase-6-6,15-8,24(完了後の調整),34-3,35-3,35(完了後の調整)
// Phase-15-8:追記 ── StreamChatError(@/features/hearing/api/streamChat)
// Phase-34-3:追記 ── getHearingPoints, HearingPointsView(@/features/hearing/api/hearingApi)
// Phase-35-3:追記 ── composeAnswerText・latestAiMessage・markSelected・pendingAnswers(@/features/hearing/cards),
//   HearingCard(@/features/hearing/api/hearingApi)
// Phase-35(完了後の調整):追記 ── markPointNotApplicable(@/features/hearing/api/hearingApi)
import { create } from "zustand";
import { streamChat, StreamChatError } from "@/features/hearing/api/streamChat";
import {
  composeAnswerText,
  latestAiMessage,
  markSelected,
  pendingAnswers,
} from "@/features/hearing/cards";
import {
  getChatHistory,
  getHearingCompletion,
  getHearingPoints,
  getProject,
  markPointNotApplicable,
  triggerGeneration,
} from "@/features/hearing/api/hearingApi";
import type {
  ChatHistoryEntry,
  HearingCard,
  HearingCompletionCheck,
  HearingPointsView,
} from "@/features/hearing/api/hearingApi";
import type { ProjectStatus } from "@/features/dashboard/api/projects";
import type { AsyncStatus } from "@/lib/api/types";

// Phase-35(完了後の調整):追記
// 「任意項目についてヒアリングを続ける」で、サーバーが利用者の発言として残す文(楽観表示も同じ文)
export const CONTINUE_OPTIONAL_MESSAGE = "任意の項目についてもヒアリングを続けてください";

type HearingStore = {
  // Phase-24:追記
  // 今の内容がどのプロジェクトのものか。別のプロジェクトを開いたら、前の会話・完了判定を
  // 捨ててから読む(ストアは画面をまたいで残るため)。
  projectId: string | null;
  messages: ChatHistoryEntry[];
  historyStatus: AsyncStatus;
  sending: boolean;
  // ストリーミング中のAI応答本文。完了すると`messages`へ確定エントリとして追加され、
  // 空文字に戻る。
  streamingReply: string;
  // SSE接続が完了前に切れた場合に立てるフラグ(#17: 冪等性キーが無いため自動再送はしない)。
  connectionLost: boolean;
  // Phase-15-8:追記
  // バックエンドがSSEの`event: error`で伝えた失敗の内容(クォータ超過など)。接続の切断
  // (connectionLost)と分けて、何が起きたかを利用者に見せる。
  streamError: string | null;
  completion: HearingCompletionCheck | null;
  // Phase-34-3:追記
  // 観点の表(チャット画面のパネル)。発言のたびにサーバーが判定し直すので、completionと同じ
  // タイミングで取り直す。
  points: HearingPointsView | null;
  // Phase-35-3:追記
  // 選択肢カードで選んでいる選択肢(カードの id → 選択肢の番号)。送信までは送らず、選び直せる。
  cardDrafts: Record<string, number>;
  // 「今まさに生成が進行中で、完了をポーリングして自動遷移すべき」ことを表す
  // (status==="generating"のときのみtrue)。過去に生成済み(completed/revising)は
  // 含めない ── 含めるとチャット画面を開くたびに/documentsへ強制的に押し戻されてしまうため。
  generationTriggered: boolean;
  // ダッシュボードの状態表示・チャット画面での「生成済みドキュメントへの常設リンク」表示判定に使う。
  projectStatus: ProjectStatus | null;

  loadHistory: (projectId: string) => Promise<void>;
  // Phase-35-3:追記
  // 選択中のカードの回答も一緒に送る(選んだ内容と text を1つの発言にする)
  // Phase-35(完了後の調整)：更新(cardIds を渡すと、そのカードの回答だけを送る。カードごとの「この回答を送る」)
  // sendMessage: (projectId: string, text: string) => Promise<void>;
  // ↓↓
  // Phase-35(完了後の調整)：更新(continueOptional は、必須がそろった後も任意の観点のヒアリングを続ける)
  // sendMessage: (projectId: string, text: string, options?: { cardIds?: string[] }) => Promise<void>;
  // ↓↓
  sendMessage: (
    projectId: string,
    text: string,
    options?: { cardIds?: string[]; continueOptional?: boolean },
  ) => Promise<void>;
  // Phase-35(完了後の調整):追記
  // 観点の表の画面から、未決の観点を「対象外(後で決める)」にし、表と完了判定を取り直す。
  // 失敗は呼び出し側に投げる(画面が理由を出す)
  skipPoint: (projectId: string, pointKey: string) => Promise<void>;
  // Phase-35-3:追記
  // 選んだ選択肢を置く(ラジオボタンなので外さない。別の選択肢を選び直す)
  selectCardOption: (cardId: string, option: number) => void;
  approveAndGenerate: (projectId: string) => Promise<void>;
  dismissConnectionLost: () => void;
};

// Phase-24:追記
// 別のプロジェクトを開いたときに戻す値
const PROJECT_INITIAL = {
  messages: [] as ChatHistoryEntry[],
  sending: false,
  streamingReply: "",
  connectionLost: false,
  streamError: null,
  completion: null,
  // Phase-34-3:追記
  points: null,
  // Phase-35-3:追記
  cardDrafts: {} as Record<string, number>,
  generationTriggered: false,
  projectStatus: null,
} as const;

// Phase-34-3:追記
type StoreGet = () => HearingStore;
type StoreSet = (partial: Partial<HearingStore>) => void;

// 観点の表を取り直す。失敗はチャット自体をブロックしない(完了判定と同じ方針)。
async function loadPoints(projectId: string, get: StoreGet, set: StoreSet): Promise<void> {
  try {
    const points = await getHearingPoints(projectId);
    // 取得中に別のプロジェクトへ移っていたら、古い結果で上書きしない
    if (get().projectId === projectId) set({ points });
  } catch {
    // 表が出ないだけで、チャットは続けられる
  }
}

export const useHearingStore = create<HearingStore>((set, get) => ({
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

  loadHistory: async (projectId) => {
    // Phase-24:追記
    if (get().projectId !== projectId) {
      set({ projectId, ...PROJECT_INITIAL });
    }
    set({ historyStatus: "loading" });
    try {
      const [messages, project] = await Promise.all([
        getChatHistory(projectId),
        getProject(projectId),
      ]);
      // Phase-24:追記
      // 取得中に別のプロジェクトへ移っていたら、古い結果で上書きしない
      if (get().projectId !== projectId) return;
      const generationTriggered = project.status === "generating";
      set({ messages, historyStatus: "success", generationTriggered, projectStatus: project.status });

      if (project.status === "interviewing" || project.status === "revising") {
        // ヒアリング完了バナーは画面更新・再遷移をまたいでも消えないよう、
        // マウント時に毎回サーバー側の判定を取り直す(completionはstoreに永続化していないため)。
        // revising(修正中)でも、ヒアリングが十分になれば通常通りバナーを出し再生成へ進める。
        try {
          const completion = await getHearingCompletion(projectId);
          set({ completion });
        } catch {
          // 完了判定の失敗はチャット自体をブロックしない(sendMessage側と同じ方針)
        }
      }
      // Phase-34-3:追記
      // 観点の表は生成の後も見られるよう、状態によらず取る
      await loadPoints(projectId, get, set);
    } catch {
      set({ historyStatus: "error" });
    }
  },

  // Phase-35(完了後の調整)：更新
  // sendMessage: async (projectId, text) => {
  // ↓↓
  sendMessage: async (projectId, text, options) => {
    // Phase-15-8：更新(元のコメントは実装と食い違っていた(発話はストリームの最後にまとめて保存される))
    // // ユーザー発話はChatService.stream_reply内でストリーム開始前に永続化される
    // // (devex-api app/services/chat_service.py参照)ため、ここで即座にローカル表示しても
    // // 安全(ストリームが途中で切れても、この発話自体がロストすることはない)。
    // ↓↓
    // ユーザー発話は、AI応答の保存と同じタイミング(ストリームの最後)でまとめて永続化される
    // (devex-api app/services/chat_service.py)。途中で失敗するとバックエンドは発話ごと
    // Phase-35-3：更新
    // // 巻き戻すため、失敗を伝えられたときはこの楽観的な表示を取り消す。
    // ↓↓
    // 巻き戻すため、失敗を伝えられたときはこの楽観的な表示(カードの選択を含む)を取り消す。
    const previousMessages = get().messages;
    const previousDrafts = get().cardDrafts;
    const latest = latestAiMessage(previousMessages);
    const cards = latest?.cards ?? [];
    // Phase-35(完了後の調整)：更新
    // const answers = pendingAnswers(cards, previousDrafts);
    // ↓↓
    const cardIds = options?.cardIds;
    const answers = pendingAnswers(cards, previousDrafts).filter(
      (answer) => !cardIds || cardIds.includes(answer.card_id),
    );
    const optimisticUserMessage: ChatHistoryEntry = {
      id: `local-user-${Date.now()}`,
      sender: "user",
      // Phase-35-3：更新
      // message: text,
      // ↓↓
      // Phase-35(完了後の調整)：更新(「任意を続ける」だけの送信は決まった文を表示する)
      // message: composeAnswerText(cards, answers, text),
      // ↓↓
      message:
        composeAnswerText(cards, answers, text) ||
        (options?.continueOptional ? CONTINUE_OPTIONAL_MESSAGE : ""),
      created_at: new Date().toISOString(),
    };
    // Phase-6-6：更新(生成済みのプロジェクトへ発話するとサーバー側(ChatService.stream_reply)が
    // completed→revisingへ遷移させるが、storeのprojectStatusはloadHistoryでしか更新されず
    // "completed"のまま取り残され、新しい完了バナーのボタンが押せないままになる不具合があった。
    // サーバー側と同じ遷移をここで即時に反映する)
    // set((state) => ({
    //   messages: [...state.messages, optimisticUserMessage],
    //   sending: true,
    //   streamingReply: "",
    //   connectionLost: false,
    // }));
    // ↓↓
    // Phase-35-3:追記
    const answeredMessages =
      latest && answers.length > 0
        ? previousMessages.map((m) => (m === latest ? { ...m, cards: markSelected(cards, answers) } : m))
        : previousMessages;
    set((state) => ({
      // Phase-35-3：更新
      // messages: [...state.messages, optimisticUserMessage],
      // ↓↓
      messages: [...answeredMessages, optimisticUserMessage],
      // Phase-35(完了後の調整):追記 ── 送ったカードの返信で最新の発言が変わり、残りのカードは選べなくなるので、選択中はすべて捨てる
      cardDrafts: {},
      sending: true,
      streamingReply: "",
      connectionLost: false,
      // Phase-15-8:追記
      streamError: null,
      projectStatus: state.projectStatus === "completed" ? "revising" : state.projectStatus,
    }));

    try {
      // Phase-35-3：更新
      // for await (const delta of streamChat(projectId, text)) {
      //   set((state) => ({ streamingReply: state.streamingReply + delta }));
      // ↓↓
      let replyCards: HearingCard[] = [];
      // Phase-35(完了後の調整)：更新
      // for await (const event of streamChat(projectId, text, { cardAnswers: answers })) {
      // ↓↓
      const streamOptions = options?.continueOptional
        ? { cardAnswers: answers, continueOptional: true }
        : { cardAnswers: answers };
      for await (const event of streamChat(projectId, text, streamOptions)) {
        if (event.kind === "delta") {
          set((state) => ({ streamingReply: state.streamingReply + event.delta }));
        } else {
          replyCards = event.cards;
        }
      }
      const aiMessage: ChatHistoryEntry = {
        id: `local-ai-${Date.now()}`,
        sender: "ai",
        message: get().streamingReply,
        // Phase-35-3:追記
        cards: replyCards.length > 0 ? replyCards : null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, aiMessage], streamingReply: "", sending: false }));

      // AI応答が完了するたびにヒアリング完了条件を確認し、十分ならユーザーへ提示する
      // (docs/external_design.md 2.3節)。失敗しても致命的ではないため無視する。
      try {
        const completion = await getHearingCompletion(projectId);
        set({ completion });
      } catch {
        // 完了判定の失敗はチャット自体をブロックしない
      }
      // Phase-34-3:追記
      await loadPoints(projectId, get, set);
    // Phase-15-8：更新(気づき#2: event: error で伝えられた失敗を見分ける)
    // } catch {
    //   // 接続切断等。自動再送はせず、ユーザーに再接続を促すバナーを表示するに留める
    //   // (Phase-2-5の既知の簡略化: SSE切断時のAI応答部分永続化は行っていない)。
    //   set({ sending: false, connectionLost: true, streamingReply: "" });
    // }
    // ↓↓
    } catch (err) {
      if (err instanceof StreamChatError && err.code) {
        // Phase-35-3：更新
        // // バックエンドが失敗を伝えた(発話は保存されていない)。表示した発話を取り消し、理由を見せる
        // set((state) => ({
        //   messages: state.messages.filter((m) => m.id !== optimisticUserMessage.id),
        // ↓↓
        // バックエンドが失敗を伝えた(発話もカードの選択も保存されていない)。表示を送信の前に戻し、
        // 選んでいた選択肢も戻して、理由を見せる
        set({
          messages: previousMessages,
          cardDrafts: previousDrafts,
          sending: false,
          streamingReply: "",
          streamError: err.message,
        // Phase-35-3：更新
        // }));
        // ↓↓
        });
        return;
      }
      // 接続切断等。自動再送はせず、ユーザーに再接続を促すバナーを表示するに留める
      // (Phase-2-5の既知の簡略化: SSE切断時のAI応答部分永続化は行っていない)。
      set({ sending: false, connectionLost: true, streamingReply: "" });
    }
  },

  // Phase-35-3:追記
  // Phase-35(完了後の調整):追記
  skipPoint: async (projectId, pointKey) => {
    const points = await markPointNotApplicable(projectId, pointKey);
    if (get().projectId !== projectId) return;
    set({ points });
    try {
      // 必須がそろえば、生成のバナーが出る(サーバーが完了判定を作り直している)
      const completion = await getHearingCompletion(projectId);
      if (get().projectId === projectId) set({ completion });
    } catch {
      // 完了判定の失敗はチャット自体をブロックしない
    }
  },

  // Phase-35(完了後の調整)：更新(ラジオボタンなので外さない)
  // selectCardOption: (cardId, option) =>
  //   set((state) => {
  //     const drafts = { ...state.cardDrafts };
  //     if (drafts[cardId] === option) {
  //       delete drafts[cardId];
  //     } else {
  //       drafts[cardId] = option;
  //     }
  //     return { cardDrafts: drafts };
  //   }),
  // ↓↓
  selectCardOption: (cardId, option) =>
    set((state) => ({ cardDrafts: { ...state.cardDrafts, [cardId]: option } })),

  approveAndGenerate: async (projectId) => {
    await triggerGeneration(projectId);
    // Phase-6-6：更新(承認した完了判定は使用済みなので破棄し、projectStatusも生成中へ追従させる。
    // 残したままだと、生成後にチャットへ戻った際に前回の(承認済みの)バナーが古い状態で再表示される)
    // set({ generationTriggered: true });
    // ↓↓
    set({ generationTriggered: true, projectStatus: "generating", completion: null });
  },

  // Phase-15-8：更新
  // dismissConnectionLost: () => set({ connectionLost: false }),
  // ↓↓
  dismissConnectionLost: () => set({ connectionLost: false, streamError: null }),
}));
