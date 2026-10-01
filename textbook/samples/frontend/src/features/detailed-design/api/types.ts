// 作成：Phase-15-6
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
// devex-api app/schemas/design_stage.py に対応する(詳細設計モードの段階)。

// 画面に出す5つの状態。DB に保存するのは draft / reviewing / approved の3つで、
// not_started(行が無い)と outdated(入力が承認時から変わった)はバックエンドが導く。
export type StageState =
  "not_started" | "draft" | "reviewing" | "approved" | "outdated";

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
};
