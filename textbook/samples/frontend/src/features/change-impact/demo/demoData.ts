// 作成：Phase-41-3
import type { Change, DesignElement, EdgeKind, Ref } from "./impactModel";

// デモの仮データ。題材は Devex 自身で、appendix/measurements/stage7-baseline.md のベースラインと同じ生成物
// (stage6-effect の詳細設計モード)を縮めたもの。横断事項の要件ID(req_ids)は、ステージ7で足す予定の形。

const r = (edge: EdgeKind, ...to: string[]): Ref[] => to.map((t) => ({ to: t, edge }));

export const DEMO_ELEMENTS: DesignElement[] = [
  // 文書(要件定義書・外部設計書)
  { key: "FR-001", kind: "requirement", stage: 0, label: "対話型チャットによるヒアリング", refs: [] },
  { key: "FR-002", kind: "requirement", stage: 0, label: "4種の設計書を一括生成する", refs: [] },
  { key: "FR-011", kind: "requirement", stage: 0, label: "AI 応答の失敗時は理由を表示して再送を促す", refs: [] },
  { key: "NFR-005", kind: "requirement", stage: 0, label: "エラーログと死活監視の通知で異常に気づく", refs: [] },
  { key: "NFR-007", kind: "requirement", stage: 0, label: "本人以外が他人のプロジェクトを見られない", refs: [] },
  { key: "SCR-002", kind: "screen", stage: 0, label: "対話型チャットヒアリング画面", refs: r("requirement", "FR-001", "FR-011") },
  { key: "SCR-003", kind: "screen", stage: 0, label: "設計書プレビュー・診断画面", refs: r("requirement", "FR-002") },
  {
    key: "API POST /api/v1/chats",
    kind: "api",
    stage: 0,
    label: "チャットメッセージの送信と AI 応答の取得",
    refs: [...r("screen", "SCR-002"), ...r("requirement", "FR-001", "FR-011")],
  },
  {
    key: "API POST /api/v1/documents/generate",
    kind: "api",
    stage: 0,
    label: "4種設計書の一括生成と自己診断",
    refs: [...r("screen", "SCR-003"), ...r("requirement", "FR-002")],
  },
  // 段階1
  {
    key: "F-02",
    kind: "function",
    stage: 1,
    label: "チャットメッセージの送信と AI 応答の取得",
    refs: [...r("requirement", "FR-001", "FR-011"), ...r("screen", "SCR-002"), ...r("trigger", "API POST /api/v1/chats")],
  },
  {
    key: "F-03",
    kind: "function",
    stage: 1,
    label: "4種設計書の一括生成と自己診断の実行",
    refs: [
      ...r("requirement", "FR-002"),
      ...r("screen", "SCR-003"),
      ...r("trigger", "API POST /api/v1/documents/generate"),
    ],
  },
  // 段階2
  { key: "DFD F-02", kind: "summary", stage: 2, label: "F-02 の処理の要約", refs: r("function", "F-02") },
  { key: "DFD F-03", kind: "summary", stage: 2, label: "F-03 の処理の要約", refs: r("function", "F-03") },
  // 段階3
  { key: "TABLE chats", kind: "table", stage: 3, label: "chats", refs: [] },
  { key: "TABLE projects", kind: "table", stage: 3, label: "projects", refs: [] },
  { key: "TABLE documents", kind: "table", stage: 3, label: "documents", refs: [] },
  { key: "CRUD F-02×chats", kind: "crud", stage: 3, label: "C", refs: [...r("function", "F-02"), ...r("table", "TABLE chats")] },
  { key: "CRUD F-03×projects", kind: "crud", stage: 3, label: "RU", refs: [...r("function", "F-03"), ...r("table", "TABLE projects")] },
  { key: "CRUD F-03×documents", kind: "crud", stage: 3, label: "C", refs: [...r("function", "F-03"), ...r("table", "TABLE documents")] },
  // 段階4
  { key: "MOD app.py", kind: "module", stage: 4, label: "組み立て・認証の DI・例外の変換", refs: [] },
  { key: "MOD clients/ai.py", kind: "module", stage: 4, label: "AI サービスの呼び出し", refs: r("function", "F-02", "F-03") },
  { key: "MOD repositories/chat.py", kind: "module", stage: 4, label: "chats の CRUD", refs: r("function", "F-02") },
  { key: "MOD repositories/document.py", kind: "module", stage: 4, label: "documents の CRUD", refs: r("function", "F-03") },
  {
    key: "MOD services/chat.py",
    kind: "module",
    stage: 4,
    label: "チャットのユースケース",
    refs: [...r("function", "F-02"), ...r("depends", "MOD clients/ai.py", "MOD repositories/chat.py")],
  },
  {
    key: "MOD services/document.py",
    kind: "module",
    stage: 4,
    label: "設計書の生成・取得のユースケース",
    refs: [...r("function", "F-03"), ...r("depends", "MOD clients/ai.py", "MOD repositories/document.py")],
  },
  {
    key: "MOD api/routes/chats.py",
    kind: "module",
    stage: 4,
    label: "チャットの入口",
    refs: [...r("function", "F-02"), ...r("depends", "MOD services/chat.py")],
  },
  {
    key: "MOD api/routes/documents.py",
    kind: "module",
    stage: 4,
    label: "設計書の入口",
    refs: [...r("function", "F-03"), ...r("depends", "MOD services/document.py")],
  },
  // 段階5
  {
    key: "PROC F-02",
    kind: "procedure",
    stage: 5,
    label: "F-02 の手順(7行)",
    refs: [
      ...r("function", "F-02"),
      ...r("calls", "MOD api/routes/chats.py", "MOD services/chat.py", "MOD clients/ai.py", "MOD repositories/chat.py"),
      ...r("table", "TABLE chats"),
    ],
  },
  {
    key: "PROC F-03",
    kind: "procedure",
    stage: 5,
    label: "F-03 の手順(9行)",
    refs: [
      ...r("function", "F-03"),
      ...r("calls", "MOD api/routes/documents.py", "MOD services/document.py", "MOD clients/ai.py", "MOD repositories/document.py"),
      ...r("table", "TABLE projects", "TABLE documents"),
    ],
  },
  // 段階6
  {
    key: "LOGIC ChatService.send_message",
    kind: "logic",
    stage: 6,
    label: "services/chat.py の send_message",
    refs: [...r("placed", "MOD services/chat.py"), ...r("called_by", "PROC F-02")],
  },
  {
    key: "LOGIC DocumentService.generate_documents",
    kind: "logic",
    stage: 6,
    label: "services/document.py の generate_documents",
    refs: [...r("placed", "MOD services/document.py"), ...r("called_by", "PROC F-03")],
  },
  // 段階7
  { key: "TASK M-01-T01", kind: "task", stage: 7, label: "開発環境とベースの実装", refs: r("depends", "MOD app.py") },
  {
    key: "TASK M-02-T01",
    kind: "task",
    stage: 7,
    label: "チャットの送信と AI 応答",
    refs: [...r("function", "F-02"), ...r("depends", "MOD services/chat.py")],
  },
  {
    key: "TASK M-03-T01",
    kind: "task",
    stage: 7,
    label: "4種設計書の一括生成",
    refs: [...r("function", "F-03"), ...r("depends", "MOD services/document.py")],
  },
  {
    key: "CC 認証",
    kind: "crosscutting",
    stage: 7,
    label: "本人以外が他人のプロジェクトを見られないよう、アクセス権限を管理する",
    refs: [...r("requirement", "NFR-007"), ...r("depends", "MOD app.py")],
  },
  {
    key: "CC ログ",
    kind: "crosscutting",
    stage: 7,
    label: "エラー時にタイムスタンプ・処理ID・トレースバックを出す",
    refs: [...r("requirement", "NFR-005"), ...r("depends", "MOD app.py", "MOD clients/ai.py")],
  },
  {
    key: "CC トランザクション",
    kind: "crosscutting",
    stage: 7,
    label: "書き込みを伴う操作はサービス層で1つのトランザクション",
    refs: r("depends", "MOD services/chat.py", "MOD services/document.py"),
  },
  // 段階8
  {
    key: "UNIT M-01-T01",
    kind: "unit",
    stage: 8,
    label: "開発環境とベースの手順書",
    refs: [...r("unit", "TASK M-01-T01"), ...r("covers", "CC 認証", "CC ログ")],
  },
  {
    key: "UNIT M-02-T01",
    kind: "unit",
    stage: 8,
    label: "チャットの送信と AI 応答の手順書",
    refs: [
      ...r("unit", "TASK M-02-T01"),
      ...r("depends", "MOD services/chat.py"),
      ...r("called_by", "LOGIC ChatService.send_message"),
      ...r("covers", "CC トランザクション"),
    ],
  },
  {
    key: "UNIT M-03-T01",
    kind: "unit",
    stage: 8,
    label: "4種設計書の一括生成の手順書",
    refs: [
      ...r("unit", "TASK M-03-T01"),
      ...r("depends", "MOD services/document.py"),
      ...r("called_by", "LOGIC DocumentService.generate_documents"),
      ...r("covers", "CC トランザクション"),
    ],
  },
];

export const DEMO_CHANGES: Change[] = [
  {
    id: "fr",
    title: "機能要件 FR-011 を変える",
    key: "FR-011",
    kind: "content",
    before: "AI 応答の失敗時は理由を表示して再送を促す",
    after: "AI 応答の失敗時は自動で3回まで再試行し、だめなら理由を表示して再送を促す",
  },
  {
    id: "nfr",
    title: "非機能要件 NFR-007 を変える",
    key: "NFR-007",
    kind: "content",
    before: "本人以外が他人のプロジェクトを見られない",
    after: "ログイン必須。他人のプロジェクトは 404 を返す",
  },
  {
    id: "function",
    title: "段階1の処理 F-03 を変える",
    key: "F-03",
    kind: "content",
    before: "4種設計書の一括生成と自己診断の実行",
    after: "設計書を1つずつ生成し、自己診断を実行する",
  },
  {
    id: "rename",
    title: "段階4のモジュールを改名する",
    key: "MOD services/chat.py",
    kind: "rename",
    before: "services/chat.py",
    after: "services/chat_service.py",
  },
];
