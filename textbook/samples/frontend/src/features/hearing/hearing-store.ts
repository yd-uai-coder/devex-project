// 作成：Phase-3-5｜更新：Phase-6-6,15-8
// Phase-15-8:追記 ── StreamChatError(@/features/hearing/api/streamChat)
import { create } from "zustand";
import { streamChat, StreamChatError } from "@/features/hearing/api/streamChat";
import {
  getChatHistory,
  getHearingCompletion,
  getProject,
  triggerGeneration,
} from "@/features/hearing/api/hearingApi";
import type { ChatHistoryEntry, HearingCompletionCheck } from "@/features/hearing/api/hearingApi";
import type { ProjectStatus } from "@/features/dashboard/api/projects";
import type { AsyncStatus } from "@/lib/api/types";

type HearingStore = {
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
  // 「今まさに生成が進行中で、完了をポーリングして自動遷移すべき」ことを表す
  // (status==="generating"のときのみtrue)。過去に生成済み(completed/revising)は
  // 含めない ── 含めるとチャット画面を開くたびに/documentsへ強制的に押し戻されてしまうため。
  generationTriggered: boolean;
  // ダッシュボードの状態表示・チャット画面での「生成済みドキュメントへの常設リンク」表示判定に使う。
  projectStatus: ProjectStatus | null;

  loadHistory: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, text: string) => Promise<void>;
  approveAndGenerate: (projectId: string) => Promise<void>;
  dismissConnectionLost: () => void;
};

export const useHearingStore = create<HearingStore>((set, get) => ({
  messages: [],
  historyStatus: "idle",
  sending: false,
  streamingReply: "",
  connectionLost: false,
  // Phase-15-8:追記
  streamError: null,
  completion: null,
  generationTriggered: false,
  projectStatus: null,

  loadHistory: async (projectId) => {
    set({ historyStatus: "loading" });
    try {
      const [messages, project] = await Promise.all([
        getChatHistory(projectId),
        getProject(projectId),
      ]);
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
    } catch {
      set({ historyStatus: "error" });
    }
  },

  sendMessage: async (projectId, text) => {
    // Phase-15-8：更新(元のコメントは実装と食い違っていた(発話はストリームの最後にまとめて保存される))
    // // ユーザー発話はChatService.stream_reply内でストリーム開始前に永続化される
    // // (devex-api app/services/chat_service.py参照)ため、ここで即座にローカル表示しても
    // // 安全(ストリームが途中で切れても、この発話自体がロストすることはない)。
    // ↓↓
    // ユーザー発話は、AI応答の保存と同じタイミング(ストリームの最後)でまとめて永続化される
    // (devex-api app/services/chat_service.py)。途中で失敗するとバックエンドは発話ごと
    // 巻き戻すため、失敗を伝えられたときはこの楽観的な表示を取り消す。
    const optimisticUserMessage: ChatHistoryEntry = {
      id: `local-user-${Date.now()}`,
      sender: "user",
      message: text,
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
    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
      sending: true,
      streamingReply: "",
      connectionLost: false,
      // Phase-15-8:追記
      streamError: null,
      projectStatus: state.projectStatus === "completed" ? "revising" : state.projectStatus,
    }));

    try {
      for await (const delta of streamChat(projectId, text)) {
        set((state) => ({ streamingReply: state.streamingReply + delta }));
      }
      const aiMessage: ChatHistoryEntry = {
        id: `local-ai-${Date.now()}`,
        sender: "ai",
        message: get().streamingReply,
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
    // Phase-15-8：更新(気づき#2: event: error で伝えられた失敗を見分ける)
    // } catch {
    //   // 接続切断等。自動再送はせず、ユーザーに再接続を促すバナーを表示するに留める
    //   // (Phase-2-5の既知の簡略化: SSE切断時のAI応答部分永続化は行っていない)。
    //   set({ sending: false, connectionLost: true, streamingReply: "" });
    // }
    // ↓↓
    } catch (err) {
      if (err instanceof StreamChatError && err.code) {
        // バックエンドが失敗を伝えた(発話は保存されていない)。表示した発話を取り消し、理由を見せる
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== optimisticUserMessage.id),
          sending: false,
          streamingReply: "",
          streamError: err.message,
        }));
        return;
      }
      // 接続切断等。自動再送はせず、ユーザーに再接続を促すバナーを表示するに留める
      // (Phase-2-5の既知の簡略化: SSE切断時のAI応答部分永続化は行っていない)。
      set({ sending: false, connectionLost: true, streamingReply: "" });
    }
  },

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
