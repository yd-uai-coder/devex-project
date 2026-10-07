# Phase-25-4: ステージ5の実装計画(Phase 26〜32)

## この章の目的

[25-1](./Phase-25-1.md)・[25-5](./Phase-25-5.md) の決定から、ステージ5を実装する Phase の区切りと、Phase ごとの成果物・再利用する資産・依存関係・未確定事項をまとめる。[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節ステージ5の「対象Phase」の詳細版である。Phase の区切りは暫定で、各 Phase の着手時に見直す(ステージ4では、着手時に3回分割した。#38)。

自動実装モード: on([introduction](./Phase-25-introduction.md) 参照)。Phase 26 以降のモードは、各 Phase の着手時に決める(#21)。

## この章で作成・更新するファイル

なし(計画の文書)。

## 区切りの考え方

- **詳細設計モードを先に完成させ、簡易モードは後半**(25-1 のスコープの決定)。
- **単位の正本(段階7)を先に直す**。段階8は段階7の単位をそのまま使うので、段階7の改修が全ての前提になる。
- **決定的なチェックを、AI の生成より先に作る**。参照の解決と展開は、検証・画面の展開・AI の入力・AI 向けの出力の4か所で共有する部品で、生成の入力にもなる。
- **シーケンス図は手順書の生成の後**(25-5)。図は手順書の単位の詳細と出力に載るので、出力の Phase より前に置く。
- **E2E は最後の Phase でまとめて流す**(#36)。

## Phase 一覧

| Phase | 内容 | 主な成果物 | 再利用する資産 | 依存 |
|---|---|---|---|---|
| 26 | 段階7の改修 | 段階7の model の変更(区分 → 種別「機能/基盤」、単位の間の依存、ファイルを「モジュール」と「環境・設定のファイル(例)」に分ける)、ID の導出(`M-01-T01`)、検証(依存の循環・一覧に無い依存先・後ろの単位への依存、モジュールが段階4に無い、モジュールがファイルでない)、プロンプト(縦割りに)、作業領域(`PlanTables`)、実装計画の出力、既存データの扱い、段階7の入力の大きさの計測 | `plan.py`(`milestone_id`・`normalize_plan`・`resolve_callee`)、`STAGE_VALIDATORS[7]`、`PlanPanel`・`planOps.ts`・`ListInput` | なし |
| 27 | 段階8の土台と決定的なチェック | 段階8(`STAGES`・`STAGE_INPUTS[8]`・CHECK 1〜8 のマイグレーション)、model の形、参照の解決と展開(純粋関数)、`STAGE_VALIDATORS[8]`(手順が無い・段階4に無いファイル・段階6に無い関数・CRUD に無い処理・`call`/`function` の不一致の警告)、SCR-008 のステッパーに段階8、単位の一覧(依存順)と未定義の一覧(重要度で絞り込み・「段階Nで直す」) | `stages.py`(承認・陳腐化)、`StageSources`、`DesignStageService`、`StageWorkArea`・`StageStepper`・`StageIssueList`・`tableStyles`、デモの `procedureDocModel.ts`(`sortUnitsByDependency`・`unresolvedRefs`・`expandRef`) | 26 |
| 28 | 手順書の生成 | 単位ごとの AI の下書き(上限5、入力は展開した参照と実装ルール、`NAMING_RULES`、推測で埋めずに「未定義」を挙げる)、merge、単位の詳細(目的・ファイル・要点・テスト観点・確認方法・未定義)の表示と編集、「AI に提案を求める」の扱い | `design_stage_generation_service.py`(受け付けとバックグラウンド)、`StageGenerationContext.targets`、段階5・6の部分生成(`generation_targets`・`merge_*`)、`StageSaveBar` | 27 |
| 29 | シーケンス図 | 段階5の行に種別(同期/非同期/戻り)の欄(既存データは同期として読む)、導出の純粋関数(入れ子の推測・戻りの推測・指摘)、SVG(バックエンド)と Mermaid、段階5の検証への指摘、05章(画面・詳細設計書)と手順書の単位への表示、スタブの候補の突き合わせ | デモの `sequenceModel.ts`・`SequenceSection.tsx`、`app/uml/export/svg.py` の書式、`ProcedurePanel`・`ProcedureStepTable`、`detailed_design/document/` | 28 |
| 30 | 手順書の出力 | zip の `implementation_procedure/`(`index.md`・単位ごとの md・AI 向けの版・HTML 1枚)、画面の「AI 向けにコピー」(未定義の警告)、未承認・古いときの書き方 | `DetailedDesignExportService.collect`、`document/markdown`・`html`(`_page`)、`DesignDocumentBar`、デモの `toUnitMarkdown`・`toAiMarkdown` | 28, 29 |
| 31 | 簡易ドキュメントモードの手順書 | 実装計画書のプロンプトの変更(WBS を縦割り・ID 付きに)、簡易モードのプロジェクトで段階8だけを開く(入力は4文書)、参照先を内部設計書(`DF-<n>`・API 一覧・モジュール一覧・3.4節)から引く、画面の入口 | `doc_generator_service.py` のプロンプト、段階8の部品(27〜30) | 30 |
| 32 | 統合/E2E・デプロイでの確認 | 偽 LLM に段階8(と簡易モードの手順書)を登録し、段階1〜8 → zip の契約テスト、**既存を含めた全 E2E**(#36)、マイグレーション、本番反映の手順(`OPERATIONS.md`) | Phase 24 の偽 LLM・`e2e/helpers.ts`・`detailed-design-flow.spec.ts`・`deploy.yml` | 31 |

E2E が必要な Phase は 32 だけとし、32 の introduction で宣言する(#36)。

## 未確定事項(各 Phase の着手時に決める)

- **Phase 26**: 1つの単位に入れる処理の数、依存を人が書くか AI の下書き+検証か、改修前の形で保存された既存の段階7の扱い(読み込み時の互換か、陳腐化させて再生成を促すか)。[`stage7-recut.md`](../../appendix/implementation-procedure-sample/stage7-recut.md)「未決」も参照。
- **Phase 27**: 段階8の model の形(単位の ID を鍵にするか、段階7の並び順が変わったときの引き継ぎ)、検証の指摘のどれをエラー(承認を止める)にするか。全体の未定義を承認の条件にするか(最重要が残っていても承認できるか)。
- **Phase 28**: 「AI に提案を求める」をこの Phase で作るか(チャットに戻すか、段階の再生成の指示にするか)。ステージ8(AI 設計レビュー・再ヒアリング)との境界。
- **Phase 29**: 種別の欄を段階5の下書きのプロンプトに書かせるか、人が付けるか。05章の画面での図の置き場(タブの中か、表の横か)。
- **Phase 30**: HTML 1枚の構成(単位をタブにするか)、AI 向けの版のファイルの置き場(`ai/` か単位の md の末尾か)。
- **Phase 31**: 簡易モードで、段階8を開くための画面(SCR-005 から入るか)。

## 後続ステージへの申し送り

- 実装可能性チェックで見つかった不足のうち「本来ヒアリングで聞くべきだった」ものを分類し、ステージ6(ヒアリング改良)の観点の材料にする([ロードマップ](../../appendix/devex_roadmap.md) ステージ6「ステージ5の結果をものさしにする」)。分類の仕組みを Phase 28〜30 のどこかで持つかは、そのときに判断する。
- 単位と ID の紐づけ(単位 → 処理ID・モジュール・ファイル)は、ステージ7(変更影響分析)の入力になる。手順書に影響範囲を書かない(作成方針14章)。

## テスト観点

スタブ不要 ── 本章は計画の文書のみで、実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。
