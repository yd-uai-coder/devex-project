# Phase 26 導入: 段階7の改修 ── 縦割りの作業単位・ID・依存・ファイルの欄の分離(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の最初の実装 Phase。[Phase 25-1](../Phase-25/Phase-25-1.md) 決定1で、実装手順書の作業単位は段階7のタスクをそのまま使うと決めた。今の段階7のタスクは層の横割り(区分 = 準備/バックエンド/フロントエンド/テスト/デプロイ)で、ID と依存が無く、ファイルの欄は検証しない例である。これを次のように改める。

- **縦割りの単位**: 処理を持つタスクは機能ごとに1単位(**機能**。バックエンド・フロントエンド・テストをまとめる)、処理の無い準備・デプロイは**基盤**の単位にする。
- **ID と依存**: 単位の ID は並び順から導く(`M-01-T01`。保存しない)。単位の間に依存(先に終わっている必要がある前の単位)を持つ。
- **ファイルの欄の分離**: 段階4のパスで検証する「モジュール」と、検証しない「環境・設定のファイル(例)」に分ける。
- **既存データ**: Phase 23〜25 に作った段階7は、データ移行で新しい形に変え、承認を差し戻す。

段階8(手順書。Phase 27〜)は、この単位をそのまま使う。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-1](../Phase-25/Phase-25-1.md)(決定1と補足)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 26 の範囲と未確定事項)、[改修後の段階7の見本](../../appendix/implementation-procedure-sample/stage7-recut.md)、段階7の元の実装([Phase 23](../Phase-23/Phase-23-introduction.md))。
- 段階7の model の正本は `devex-api` の `app/detailed_design/plan.py`。画面(`devex-ui`)は同じ形の型と、編集の純粋関数(`planOps.ts`)を持つ。

```
[段階7の検証] STAGE_VALIDATORS[7] = validate_plan                                  (26-1)
  段階1(処理ID)・段階4(モジュールのパス)と突き合わせる
  単位の ID = task_id(マイルストーンの並び, タスクの並び)  ← 保存しない
[段階7の生成] generate_plan                                                         (26-2)
  build_plan_messages(要件定義, 詳細設計書 md, 横断事項, 処理ID の一覧, モジュールのパスの一覧)
  → PlanGenerationOutput(tasks: kind・depends_on・modules・config_files)→ normalize_plan
[出力] to_plan_markdown / to_plan_html(単位の表・処理ごとの単位の ID)               (26-3)
[既存データ] Alembic b8c9d0e1f2a3(区分の横割り → 作業単位、承認済み → レビュー中)    (26-4)
[画面] PlanTables(ID/種別/タスク/処理/依存/モジュール/環境・設定のファイル)         (26-5)
  planOps.relinkDependencies(並べ替え・削除で依存先の ID を付け替える)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す)。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 26 の分を、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 26 開始時」)。

1. **自動実装モード**: on。
2. **既存の段階7**: Alembic のデータ移行で新しい形に変え、承認済みの段階7はレビュー中へ差し戻す。コードは新しい形だけを扱う(読み込み時の互換は持たない)(26-4)。
3. **依存**: AI が下書きし、人が画面で直せる。検証で「一覧に無い依存先」「自分か後ろの単位への依存」をエラーにする(26-1・26-2)。
4. **1単位の処理の数**: 原則1処理。上限は設けず、4つ以上で警告(26-1)。

Claude の判断で決めたこと(計画の承認で確定):

- `Milestone.function_ids` を消し、マイルストーンの処理はタスクの処理から導く(`milestone_functions`)。単位が処理を持つので、マイルストーンにも書くと二重管理になる(26-1)。
- 依存は前の単位だけを指せる。依存の順と計画の並び順が一致し、循環の検査が要らない(26-1)。
- 実装計画の下書きに、処理ID の一覧と同じく、モジュールのパスの一覧を渡す。モジュールの欄が検証されるようになったため(26-2)。
- 並べ替え・削除で ID が変わるので、画面の操作が依存先の ID を付け替える(26-5)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-26-1.md`](./Phase-26-1.md) | 段階7の model(種別・依存・2つのファイルの欄)・単位の ID・検証 | あり(BE) | なし |
| [`Phase-26-2.md`](./Phase-26-2.md) | 実装計画の下書きのプロンプト・偽の出力・段階7の入力の大きさの計測 | あり(BE) | 26-1 |
| [`Phase-26-3.md`](./Phase-26-3.md) | 実装計画の出力(md・HTML の単位の表、処理ごとの単位の ID) | あり(BE) | 26-1 |
| [`Phase-26-4.md`](./Phase-26-4.md) | 既存の段階7のデータ移行と差し戻し | あり(BE の Alembic) | 26-1 |
| [`Phase-26-5.md`](./Phase-26-5.md) | 段階7の作業領域(単位の表・並べ替えと依存の付け替え) | あり(FE) | 26-1 |
| [`Phase-26-6.md`](./Phase-26-6.md) | `docs/*.md`・見本への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 26-1〜26-5 |

## サンプルコード一覧

`textbook/samples/backend/` 配下(26-1〜26-4):

- `app/detailed_design/plan.py`・`validation.py`・`__init__.py`(26-1)
- `app/detailed_design/plan_drafting.py`・`app/ai/llm/fake.py`・`app/services/design_stage_generation_service.py`(26-2)
- `app/detailed_design/document/views.py`・`markdown.py`・`html.py`(26-3)
- `alembic/versions/b8c9d0e1f2a3_recut_plan_stage.py`(26-4。新規)
- テスト: `tests/fixtures/detailed_design.py`、`tests/unit/test_plan.py`・`test_plan_drafting.py`・`test_design_stage_plan_generation.py`・`test_detailed_design_plan_document.py`・`test_detailed_design_plan_export.py`・`test_plan_stage_migration.py`(新規)

`textbook/samples/frontend/src/features/detailed-design/` 配下(26-5):

- `api/types.ts`・`labels.ts`・`planOps.ts`・`components/PlanTables.tsx`・`test-utils/stageFixtures.ts`
- テスト: `__tests__/planOps.test.ts`・`components/__tests__/PlanTables.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [26-1](./Phase-26-1.md) | `plan.py`・`validation.py`・`__init__.py` | 単位の形・ID の導出・検証(依存・モジュール・種別) | 純粋関数(`task_id`・`unit_ids`・`milestone_functions`・`is_file_path`・`normalize_plan`)と、検証のエラー・警告の分け方。指摘の `target` は単位の ID |
| [26-2](./Phase-26-2.md) | `plan_drafting.py`・`fake.py`・`design_stage_generation_service.py` | 縦割りの単位を下書きさせるプロンプトと入力 | プロンプトの規則・モジュールのパスの一覧が入力に入ること・偽の出力が検証を通ること・生成の統合(FakeLLM) |
| [26-3](./Phase-26-3.md) | `views.py`・`markdown.py`・`html.py` | 実装計画の単位の表と処理の割り当て | md の表の行・HTML のアンカーとバッジ・未計画の印 |
| [26-4](./Phase-26-4.md) | `b8c9d0e1f2a3_recut_plan_stage.py` | 既存の段階7の変換と差し戻し | 変換の純粋関数(種別・ファイルの振り分け・逆変換)と、変換の結果が新しい検証を通ること |
| [26-5](./Phase-26-5.md) | `types.ts`・`labels.ts`・`planOps.ts`・`PlanTables.tsx` | 単位の表の編集と依存の付け替え | 付け替え(動かす・消す)・表示・操作 |
| [26-6](./Phase-26-6.md) | `docs/*.md`・見本 | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意: 26-1 で `TaskArea` を消し、`PlanTask` の形を変えるため、26-1 だけを写した時点では、`TaskArea` を import する `plan_drafting.py`(26-2)と、区分の欄を読む出力(26-3)が動かない。テストのフィクスチャ(`tests/fixtures/detailed_design.py`)はサービス層を経由して `plan_drafting.py` を読み込むので、**26-1〜26-3 を続けて写してから**テストを流す(前方 import ではなく、削除した名前を後の章で直す形のため、#15 の監査では検出されない)。26-4・26-5 は 26-1 の後ならどの順でもよい。

## 検証結果

- devex-api: 段階7のテスト 46 件(26-1 19件・26-2 8件・26-3 14件・26-4 5件)、ユニットテスト全体 653 件成功。`ruff check`・`pyright` 成功。
- 移行: 開発 DB で `alembic upgrade head` → `downgrade -1` → `upgrade head` を確認(段階7の6件が新しい形・レビュー中になる。退避した行は作業用の場所に保存)。
- devex-ui: 段階7の表と操作のテスト 18 件、詳細設計の feature 全体 218 件成功。`tsc --noEmit`・eslint 成功。Phase 完了時の全体テストは[下記](#phase-完了時の確認)。
- `samples_check.py`: 不一致 0 件。`link_check.py`: 切れ 0 件。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 653 件成功、`ruff check`・`pyright` 成功。
- devex-ui: 全体 568 件成功(`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 417 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 25 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - `call` と `function` の書き方の揺れ → ステージ5では吸収せず、手順書の決定論的チェックで「未解決の参照」の警告として出す([25-1](../Phase-25/Phase-25-1.md) 決定9)。揺れそのものは未解決のまま
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **Phase 27〜31 の未確定事項**: [25-4](../Phase-25/Phase-25-4.md)「未確定事項」(段階8の model と承認の条件・「AI に提案を求める」の作り方・種別の欄の付け方など)。Phase 27 の「単位の ID を鍵にするか、段階7の並び順が変わったときの引き継ぎ」は、Phase 26 で ID を保存しない(並び順から導く)と決めたので、その前提で決める。
- **シーケンス図の本実装**: Phase 29([25-4](../Phase-25/Phase-25-4.md)・[25-5](../Phase-25/Phase-25-5.md))。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25 は1セッション。Phase 26 も1セッションで行った(着手時の相談 → 計画 → 26-1〜26-5 の実装と samples → 26-6 docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **既存のプロジェクトの段階7**(Phase 25 で発生): データ移行で新しい形に変え、承認を差し戻した([26-4](./Phase-26-4.md))。
- **画面確認**(この Phase で発生): ユーザーが段階7を実際の LLM で再生成し、画面で確かめて OK とした(2026-10-07)。
- **段階7の入力の大きさ**(Phase 24 から): ゴール3の生成物で計測した。横断事項の入力 約1.7万字、実装計画の入力 約1.5万字で、絞り込みは要らない([26-2](./Phase-26-2.md))。

この Phase で生まれたもの:

- **本番の段階7**: 本番に反映するときは、マイグレーション(`b8c9d0e1f2a3`)で本番の段階7もレビュー中に戻る。本番反映の手順は Phase 32 でまとめる。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 単位の ID(`M-01-T01`)を保存せず並び順から導くと、依存先を ID で持つことと何がぶつかるか。それを画面の操作(`relinkDependencies`)で解決し、検証では「前の単位だけ」と決めた理由を説明できるか。
2. 依存先を「自分より前の単位」に限ると、循環の検査が要らなくなるのはなぜか。手順書を作る順番(依存順)と計画の並び順の関係を説明できるか。
3. ファイルの欄を「モジュール」と「環境・設定のファイル」に分けると、Phase 23 で検証をやめた理由(`Dockerfile` がエラーになる)をどう避けられるか。分けた後も検証しないものは何か。
4. 既存データを「読み込み時の互換」ではなく「データ移行+差し戻し」で扱った理由を、コードの分岐と承認の意味の2点から説明できるか。
5. `Milestone.function_ids` を消して導出にしたのはなぜか。消さずに残すと、検証や出力で何が二重になるか。

## 次のフェーズ

**Phase 27**: 段階8の土台と決定的な実装可能性チェック(段階8・参照の解決と展開・検証・SCR-008 の単位の一覧と未定義の一覧)。着手時に自動実装モード(#21)と [25-4](../Phase-25/Phase-25-4.md) の Phase 27 の未確定事項を決める。
