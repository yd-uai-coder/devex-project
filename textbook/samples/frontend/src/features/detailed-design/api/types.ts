// 作成：Phase-15-6｜更新：Phase-16-5,17-5,18-5,19-5,20-4,21-4,23-5,26-5
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
// devex-api app/schemas/design_stage.py に対応する(詳細設計モードの段階)。

// Phase-16-5：更新
// // 画面に出す5つの状態。DB に保存するのは draft / reviewing / approved の3つで、
// // not_started(行が無い)と outdated(入力が承認時から変わった)はバックエンドが導く。
// ↓↓
// 画面に出す6つの状態。DB に保存するのは draft / regenerated / reviewing / approved の4つで、
// not_started(行が無い)と outdated(入力が承認時・生成時から変わった)はバックエンドが導く。
// regenerated は、内容のある段階を AI が作り直した(未承認)状態(Phase 16)。
export type StageState =
  // Phase-16-5：更新
  // "not_started" | "draft" | "reviewing" | "approved" | "outdated";
  // ↓↓
  | "not_started"
  | "draft"
  | "regenerated"
  | "reviewing"
  | "approved"
  | "outdated";

// Phase-16-5:追記
// 段階ごとの検証の指摘(Phase 16)。error があると承認できない。warning は承認を止めない。
export type StageIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  target: string | null;
};

// AIの下書きの生成の状態。null はまだ生成していない。
export type StageGenerationStatus = "generating" | "completed" | "failed";

// Phase-18-5:追記
// 段階2の DFD の線から決まる、処理とテーブルの関わり(段階3の CRUD 図の固定部分。Phase 18)。
// table は ER のテーブル名(ER に無いデータストアは、小文字にしたデータストア名)。
export type DfdAccess = {
  function_id: string;
  table: string;
  kind: "read" | "write";
};

export type DesignStageRead = {
  stage: number;
  state: StageState;
  is_open: boolean;
  // まだそろっていない入力。"stage:<n>"(承認されていない前の段階)/"doc:<doc_type>"(まだ無い文書)
  missing_inputs: string[];
  version: number | null;
  approved_version: number | null;
  model: Record<string, unknown> | null;
  updated_at: string | null;
  // Phase-16-5:追記
  generation_status: StageGenerationStatus | null;
  // 直近の生成が失敗した理由(ユーザー向けの文言)
  generation_error: string | null;
  issues: StageIssue[];
  // Phase-18-5:追記
  // 段階3だけが持つ、DFD から決まる R/W(バックエンドが導いた結果。Phase 18)
  dfd_accesses: DfdAccess[];
};

// Phase-16-5:追記
// 段階1 機能(処理)一覧の意味モデル(devex-api app/detailed_design/function_list.py)。
// 画面: サーバーを呼ばず画面の中で完結する演算・描画(trigger は「SCR-005: 操作」の形)
export type FunctionKind = "API" | "API+バッチ" | "バッチ" | "画面" | "その他";

export type FunctionRow = {
  id: string; // 処理ID(F-01…)。再生成しても変わらない
  name: string;
  kind: FunctionKind;
  trigger: string; // API は「POST /api/v1/projects」の形
  screens: string[];
  group_initial: string; // API のパスから決めた機能グループの初期値
  group: string; // 人が確定した機能グループ
  summary: string;
};

export type FunctionListModel = {
  groups: string[];
  functions: FunctionRow[];
  next_number: number; // 次に振る番号(消えた番号は再利用しない)
};

// Phase-17-5:追記
// 段階2 データフローの意味モデル(devex-api app/detailed_design/data_flow.py)。
// DFD 本体は uml_diagrams(notation=dfd、subject=機能グループ名)、データ辞書は data_items が正本で、
// ここには持たない(Phase 17)。
export type ProcessSummaryRow = {
  function_id: string; // 段階1の処理ID
  input: string;
  process: string;
  output: string;
};

export type DataFlowModel = {
  dfd_groups: string[]; // DFD を描く機能グループ(人が選ぶ。最大 MAX_DFD_GROUPS)
  summaries: ProcessSummaryRow[]; // 全処理の処理概要表(機能一覧の並び)
};

// 1回の生成で DFD を描けるグループの数の上限(devex-api の MAX_DFD_GROUPS と同じ)
export const MAX_DFD_GROUPS = 5;

// Phase-18-5:追記
// 段階3 データモデルの意味モデル(devex-api app/detailed_design/data_model.py)。
// ER・テーブル定義は uml_diagrams(notation=er、subject='')が正本で、ここには CRUD 図のセルだけを
// 持つ(Phase 18)。ops は C・R・U・D をこの順に並べた文字列(「CR」など)。draft は AI の下書きの
// まま人が確定していない印(人が直すと外れ、段階3の承認で残りも外れる)。
export type CrudCell = {
  function_id: string; // 段階1の処理ID
  table: string; // ER のテーブル名
  ops: string;
  draft: boolean;
};

export type CrudModel = {
  cells: CrudCell[]; // 操作の無いセルは持たない
};

// 段階3の ER を uml_diagrams で識別するキー(devex-api の ER_SUBJECT と同じ。全体1枚)
export const ER_SUBJECT = "";

// Phase-19-5:追記
// 段階4 ソフトウェア構造の意味モデル(devex-api app/detailed_design/structure.py)。
// 構成図は uml_diagrams(notation=component、subject='')が正本で、ここにはファイル単位のモジュール一覧
// だけを持つ(Phase 19)。path は段階5の「処理 × モジュール」の関与表の列の鍵になる。
export type ModuleRow = {
  path: string; // ファイルのパス(似たファイルは {a,b}.py・* でまとめてよい)
  layer: string; // 構成図の層(要素の layer)の名前
  responsibility: string;
  depends_on: string[]; // 一覧の他のモジュールはパスで、外部のライブラリは名前で書く
  functions: string[]; // 関わる処理の処理ID(機能一覧の順)
  all_functions: boolean; // 全処理が通る横断のモジュール(文書では「全処理」)
};

export type ModuleListModel = {
  modules: ModuleRow[];
};

// 段階4の構成図を uml_diagrams で識別するキー(devex-api の STRUCTURE_SUBJECT と同じ。全体1枚)
export const STRUCTURE_SUBJECT = "";

// Phase-20-4:追記
// 段階5 主要処理の手順の意味モデル(devex-api app/detailed_design/procedure.py)。人が選んだ処理ごとに
// 手順の表を持つ(Phase 20)。手順番号は保存せず、並び順と is_branch から導く(procedureOps の
// numberSteps)。06(段階6)との紐づけは持たず、(callee, call) と段階6の (モジュール, 関数) の一致から導く。
export type ProcedureStep = {
  caller: string; // 呼び出し元(モジュールのパスか外部の役者)。分岐の行は空
  callee: string; // 呼び出し先。モジュール一覧のパス(関与表の列の鍵)か外部の役者(「/」を含まない名前)
  call: string; // 呼び出し先で呼ぶ関数・メソッド
  data: string;
  action: string; // 処理内容。分岐の行は分岐する条件
  result: string;
  db: string; // DB 操作(「reservations C」など)
  branch: string; // 分岐・例外。分岐の行はその結果
  is_branch: boolean; // 分岐の行(元の手順の直後に置く)
};

export type Procedure = {
  function_id: string; // 段階1の処理ID
  reason: string; // 手順を書く対象に選んだ理由
  note: string; // トランザクションの範囲などの注記
  steps: ProcedureStep[]; // 空ならまだ下書きを作っていない
};

export type ProcedureModel = {
  procedures: Procedure[]; // 選んだ処理(機能一覧の順)
};

// 1回の生成で下書きを作れる処理の数の上限(devex-api の MAX_PROCEDURE_TARGETS と同じ)
export const MAX_PROCEDURE_TARGETS = 5;

// Phase-21-4:追記
// 段階6 処理ロジックの詳細の意味モデル(devex-api app/detailed_design/logic.py)。人が選んだ関数ごとに
// シグネチャ〜事後条件と擬似フローを持つ(Phase 21)。L-ID は保存せず並び順から導く(logicOps の logicId)。
// 05 との紐づけは (module, function) と段階5の手順の (callee, call) の一致から導く。0件で承認 = 段階6を飛ばす。
export type PseudoStep = {
  text: string; // この段で行うこと
  sub: string[]; // 条件の分かれ目・細かい手順の箇条
};

export type LogicRow = {
  module: string; // 段階4のモジュール一覧のパス(= 手順の callee)
  function: string; // 手順の call
  signature: string;
  args: string;
  returns: string;
  raises: string;
  pre: string; // 事前条件
  post: string; // 事後条件
  pseudo: PseudoStep[];
};

export type LogicModel = {
  logics: LogicRow[]; // 選んだ関数(シグネチャと擬似フローが空ならまだ下書きが無い)
};

// 段階6の生成で下書きを作る関数の指定(devex-api の LogicTarget)
export type LogicTarget = { module: string; function: string };

// 1回の生成で下書きを作れる関数の数の上限(devex-api の MAX_LOGIC_TARGETS と同じ)
export const MAX_LOGIC_TARGETS = 5;

// Phase-23-5:追記
// 段階7 横断事項と実装計画の意味モデル(devex-api app/detailed_design/plan.py。Phase 23)。07 横断事項と
// 実装計画を1つの model に持つ。タスクはマイルストーンの中に入れ子にする(改名で参照が切れないため)。
// タスクは実装手順書の作業単位で、機能ごとの縦割り(feature)か、処理の無い準備・デプロイ(base)。
// マイルストーンの番号(M-01…)と単位の ID(M-01-T01…)は保存せず並び順から導く(planOps の
// milestoneId・taskId)。依存は単位の ID で書き、並べ替えたときは planOps が付け替える。
export type Priority = "Must" | "Should" | "Could";
// Phase-26-5：更新
// export type TaskArea = "準備" | "バックエンド" | "フロントエンド" | "テスト" | "デプロイ";
// ↓↓
export type UnitKind = "feature" | "base";

export type CrossCuttingRow = {
  topic: string; // 項目(例外と HTTP など)
  policy: string; // 方針
  modules: string[]; // 関わるファイルの例(段階4のパスや設定のファイル。検証しない)
};

export type PlanTask = {
  // Phase-26-5：更新
  // area: TaskArea;
  // ↓↓
  kind: UnitKind;
  title: string;
  // Phase-26-5：更新
  // modules: string[];
  // function_ids: string[];
  // ↓↓
  function_ids: string[]; // この単位で動くようにする処理(原則1つ)
  depends_on: string[]; // 先に終わっている必要がある単位の ID(前の単位だけ)
  modules: string[]; // 段階4のモジュール一覧のパス(検証する)
  config_files: string[]; // 環境・設定のファイルの例(検証しない)
};

// Phase-26-5:追記
// 動くようにする処理は保存せず、タスクの処理から導く(planOps の milestoneFunctions)
export type Milestone = {
  name: string;
  goal: string;
  priority: Priority;
  // Phase-26-5：削除
  // function_ids: string[]; // このマイルストーンで動くようにする処理
  tasks: PlanTask[];
};

export type Risk = { risk: string; mitigation: string };

export type PlanModel = {
  crosscutting: CrossCuttingRow[];
  milestones: Milestone[];
  environment: string; // 開発環境・CI/CD・事前準備
  risks: Risk[];
};

// devex-api の PRIORITIES・UNIT_KINDS・MAX_UNIT_FUNCTIONS・CROSSCUTTING_TOPICS と同じ値
export const PRIORITIES: Priority[] = ["Must", "Should", "Could"];
// Phase-26-5：更新
// export const TASK_AREAS: TaskArea[] = ["準備", "バックエンド", "フロントエンド", "テスト", "デプロイ"];
// ↓↓
export const UNIT_KINDS: UnitKind[] = ["feature", "base"];
export const MAX_UNIT_FUNCTIONS = 3;
export const CROSSCUTTING_TOPICS = ["例外と HTTP", "認証", "トランザクション", "ログ"];
