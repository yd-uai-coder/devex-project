# Phase 27 導入: 段階8の土台と決定的な実装可能性チェック(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の2つ目の実装 Phase。[Phase 26](../Phase-26/Phase-26-introduction.md) で、段階7のタスクを縦割りの作業単位(ID `M-01-T01` は並び順から導く・依存は前の単位だけ)に改めた。この Phase では、手順書の置き場である段階8を足し、AI を使わない決定的なチェックで設計の不足・食い違いを出す。

- **段階8の登録**: `design_stages` の段階を1〜8にし、承認・陳腐化・生成の状態の仕組みをそのまま使う(入力は段階1〜7と要件定義)。
- **手順書の model**: 単位ごとの手順書(目的・ファイル・実装の要点・テスト観点・確認方法・AI の指摘)。鍵は単位の ID と、作ったときのタスク名。
- **参照の導出と解決**: 単位の処理ID・モジュールから、参照する設計(段階5の手順・段階6の関数・段階4のモジュール)を導き、設計にあるかを判定する。
- **決定的な実装可能性チェック**: 設計の不足を、重要度(最重要/中程度/軽微)と直す先の段階を持つ警告として出す。手順書がまだ無くても出る。
- **SCR-008 の段階8**: 単位の一覧(依存順)と、未定義・要決定の一覧(重要度の絞り込み・「段階Nで直す」)。

手順書の AI 生成と単位の詳細は Phase 28。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-1](../Phase-25/Phase-25-1.md)(決定2〜4・9・10)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 27 の範囲と未確定事項)、[Phase 26 の introduction](../Phase-26/Phase-26-introduction.md)(単位の ID と依存)、見本の [`index.md`](../../appendix/implementation-procedure-sample/implementation_procedure/index.md)(単位の一覧と未定義の一覧)とデモの `procedureDocModel.ts`(`devex-ui/src/features/implementation-procedure/demo/`)。
- 段階の仕組みの正本は `devex-api` の `app/detailed_design/stages.py`(状態と陳腐化)・`validation.py`(段階ごとの検証)・`app/services/design_stage_service.py`。画面は `STAGE_PANELS` に段階ごとのパネルを登録する。

```
[段階8の登録] STAGES=(1..8)・STAGE_INPUTS[8]=段階1〜7+要件定義・CHECK 1〜8(Alembic c9d0e1f2a3b4) (27-1)
[model] ProcedureDocModel(units: [unit_id・title・purpose・files・notes・tests・gwt・verify・findings]) (27-1)
        plan_units(段階7) → 単位の一覧(計画の並び順 = 依存順)
[参照] design_index(段階3〜6) + unit_refs(タスク) → [DesignRef(kind, key, resolved, via)]     (27-2)
[検証] STAGE_VALIDATORS[8] = validate_procedure_doc                                           (27-2)
        エラー: INVALID_MODEL / DUPLICATE_UNIT / UNIT_MISMATCH
        警告(level・fix_stage・unit): NO_PROCEDURE / NOT_IN_CRUD / MODULE_NOT_FILE / UNKNOWN_FILE / UNRESOLVED_CALL
        手順書が無くても検証する(VALIDATED_WITHOUT_MODEL、_to_read)
[画面] ProcedureDocPanel: 単位の一覧 + 未定義の一覧(絞り込み・段階Nで直す = jumpTo)           (27-3)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す)。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 27 の分を、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 27 開始時」)。

1. **自動実装モード**: on。
2. **段階8の鍵**: 単位の ID と、作ったときのタスク名を保存する。段階7の並べ替え・改名で合わなくなった手順書は検証のエラー(`UNIT_MISMATCH`)にし、作り直させる(自動で付け替えない)(27-1)。
3. **承認の条件**: 承認を止めるのは手順書そのものの不正(形・重複・段階7と合わない)だけ。設計の不足は重要度と直す先の段階を持つ警告で、承認を止めない(27-2)。
4. **参照の展開**: 最初に使う Phase 28 へ移す。この Phase は導出と解決だけ(27-2。#17)。

Claude の判断(計画の承認で確定):

- 単位の一覧は段階7の並び順のまま(依存は前の単位だけなので、これが依存順)(27-1)。
- 段階8の入力に要件定義を入れる(Phase 30 の index の「対象外」で使う。後から足すと承認済みの段階8が全部「古い」になるため)(27-1)。
- `StageIssue` に、段階8だけが持つ任意の欄 `level`・`fix_stage`・`unit` を足す(27-2)。
- 段階8は、行が無くても開いていれば検証する(27-2)。

実装で計画から変えたこと:

- `NO_PROCEDURE`(処理に段階5の手順が無い)を、計画の「最重要」から「中程度」にした。段階5は主要処理だけを選ぶ段階で、手順の無い処理は普通にあるため(27-2)。
- `UNRESOLVED_CALL` は、段階6の関数と書き方だけが違う呼び出し(小文字にし `_`・`-` を除くと等しい)だけに出し、文言で「段階5の手順の関数名を段階6の名前にそろえる」と示す(段階6は任意なので、選ばなかった関数は指摘しない)。最初は「段階6で関数を選んだモジュールの、一致しない呼び出し」に出していたが、画面確認で直した(27-2)。
- 「最重要が残っているときの承認前の確認」は、段階8を承認できるようになる Phase 28 で作る(この Phase では手順書を作れず、承認できないため。#17)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-27-1.md`](./Phase-27-1.md) | 段階8の登録と手順書の model | あり(BE) | なし |
| [`Phase-27-2.md`](./Phase-27-2.md) | 参照の導出と段階8の検証(決定的な実装可能性チェック) | あり(BE) | 27-1 |
| [`Phase-27-3.md`](./Phase-27-3.md) | SCR-008 の段階8 ── 単位の一覧と未定義の一覧 | あり(FE) | 27-2(API の指摘の欄) |
| [`Phase-27-4.md`](./Phase-27-4.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 27-1〜27-3 |

## サンプルコード一覧

`textbook/samples/backend/` 配下(27-1・27-2):

- `app/detailed_design/stages.py`・`procedure_doc.py`(新規)・`validation.py`・`__init__.py`
- `app/models/design_stage.py`・`project.py`、`alembic/versions/c9d0e1f2a3b4_add_procedure_doc_stage.py`(新規)
- `app/schemas/design_stage.py`・`app/services/design_stage_service.py`・`app/api/routes/design_stages.py`
- テスト: `tests/fixtures/detailed_design.py`、`tests/unit/test_procedure_doc.py`(新規)・`test_procedure_doc_validation.py`(新規)・`test_design_stage_procedure_doc.py`(新規)・`test_design_stage_service.py`・`test_function_list.py`・`test_fake_llm_detailed_design.py`

`textbook/samples/frontend/src/features/detailed-design/` 配下(27-3):

- `api/types.ts`・`api/designStagesApi.ts`・`labels.ts`・`detailed-design-store.ts`・`procedureDocOps.ts`(新規)
- `components/ProcedureDocPanel.tsx`(新規)・`StageWorkArea.tsx`・`StageStepper.tsx`・`DetailedDesignPageContent.tsx`
- テスト: `test-utils/stageFixtures.ts`、`__tests__/procedureDocOps.test.ts`(新規)・`detailed-design-store.test.ts`、`components/__tests__/ProcedureDocPanel.test.tsx`(新規)・`StageStepper.test.tsx`・`DetailedDesignPageContent.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [27-1](./Phase-27-1.md) | `stages.py`・`procedure_doc.py`(前半)・`design_stage.py`・移行・`design_stages.py` | 段階8を段階の仕組みに載せ、手順書の形と単位の並びを決める | model の既定値・`plan_units` の並び(純粋)、段階の一覧が1〜8(サービス・ルート)、段階1〜7の承認で段階8が開く |
| [27-2](./Phase-27-2.md) | `procedure_doc.py`(後半)・`validation.py`・`design_stage.py`(schema)・`design_stage_service.py` | 参照の導出と、設計の不足の決定的な指摘 | `unit_refs` の順と解決(純粋)、指摘ごとの重さ・重要度・直す先の段階、手順書が無くても指摘が出る(偽の検証で `_to_read` を確かめる) |
| [27-3](./Phase-27-3.md) | `types.ts`・`labels.ts`・`procedureDocOps.ts`・`ProcedureDocPanel.tsx`・`StageWorkArea.tsx` | 単位の一覧と未定義の一覧の表示、対象の段階への移動 | 純粋関数(並び・手順書の有無・指摘のまとめ方)、表示・絞り込み・「段階Nで直す」(`jumpTo` をスタブ) |
| [27-4](./Phase-27-4.md) | `docs/*.md` | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意: `procedure_doc.py` と `test_procedure_doc.py` は 27-1 で前半、27-2 で後半を書く(samples ではタグで区別している)。`test_procedure_doc.py` の import 文のうち 27-2 の名前(`DesignRef`・`design_index`・`unit_refs` など)は、27-2 で足す。

実 import 監査(#15): 各章のファイルの import 先は、以前の Phase か、その章までにある。27-1 の `procedure_doc.py` の前半は `plan` だけを読み、27-2 で `data_model`・`logic`・`procedure`・`structure`(いずれも既存)を足す。27-3 の `procedureDocOps.ts` は既存の `planOps.ts`(`milestoneId`・`taskId`)を読む。章が作成・更新するファイルは、移行ファイル(DDL だけで純粋関数を持たない。開発 DB で確かめた)を除き、その章のテストが少なくとも1度 import する(コメントだけを変えた `project.py`・`designStagesApi.ts` などは、fixture やストア越しに import される)。

## 検証結果

- devex-api: 段階8のテスト 28 件(27-1・27-2。`test_procedure_doc.py` 9件・`test_procedure_doc_validation.py` 13件・`test_design_stage_procedure_doc.py` 6件)、ユニットテスト全体 681 件成功(画面確認後の修正の後)。`ruff check`・`pyright` 成功。
- 移行: 開発 DB で `alembic upgrade head` → `downgrade -1` → `upgrade head` を確認(制約が `stage >= 1 AND stage <= 8` になる)。
- devex-ui: 詳細設計の feature 全体 227 件成功(`--maxWorkers=4`)。`tsc --noEmit`・eslint 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件。`link_check.py`: 切れ 0 件。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 678 件成功、`ruff check`・`pyright` 成功(画面確認後の修正の後は 681 件成功)。
- devex-ui: 全体 577 件成功(`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 426 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

## 未消化の申し送り(#37)

Phase 26 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - `call` と `function` の書き方の揺れ → 段階8の検証で `UNRESOLVED_CALL`(軽微・段階5)として出すようにした([27-2](./Phase-27-2.md))。揺れそのものは吸収しない方針のまま
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **Phase 28〜31 の未確定事項**: [25-4](../Phase-25/Phase-25-4.md)「未確定事項」(「AI に提案を求める」の作り方・種別の欄の付け方など)。
- **シーケンス図の本実装**: Phase 29([25-4](../Phase-25/Phase-25-4.md)・[25-5](../Phase-25/Phase-25-5.md))。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **本番の段階7**(Phase 26 で発生): 本番に反映するときは、マイグレーション(`b8c9d0e1f2a3`)で本番の段階7もレビュー中に戻る。本番反映の手順は Phase 32 でまとめる(段階8の CHECK の移行 `c9d0e1f2a3b4` も同じ順で流す)。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25・26・27 はそれぞれ1セッション(着手時の相談 → 計画 → 実装と samples → docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **Phase 27 の未確定事項**([25-4](../Phase-25/Phase-25-4.md)): 段階8の鍵と並べ替え時の扱い・承認の条件を、着手時に決めた(上記「着手時の相談で決めたこと」)。

この Phase で生まれたもの:

- **参照の展開と、最重要が残るときの承認前の確認**: Phase 28 で作る([27-2](./Phase-27-2.md))。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3(CRUD 図のセル)・段階4(モジュールの行)・段階7(単位の行)は段階を開くだけ。必要なら Phase 28 以降で、各パネルに `focus` を読ませる。
- **画面確認**(途中): ユーザーの確認で、`UNRESOLVED_CALL` の文言(段階6が主語)とボタン(段階5で直す)の食い違いが見つかり、条件と文言を直した([27-2](./Phase-27-2.md)「`UNRESOLVED_CALL` を出す範囲」)。直した後の画面で、選ばなかった関数の行が消えること・揺れの行の文言とボタンが一致することを、ユーザーが確かめる。

## 後続 Phase での改訂

- Phase 28: `procedure_doc.py` に `find_unit`(28-1)と、生成の対象・merge(`MAX_PROCEDURE_DOC_TARGETS`・`documented_unit_ids`・`generation_targets`・`merge_unit_procedure`。28-2)を足した。段階8に生成器を登録したので、`test_design_stage_procedure_doc.py` の「生成は未対応」のテストを消した。`ProcedureDocPanel` の props に `projectId`・`onDirtyChange` を足し、生成・単位の詳細・保存を持たせた([Phase-28-introduction](../Phase-28/Phase-28-introduction.md))。

## Phase 完了チェック(#22)

1. 段階8の手順書を、単位の ID だけでなく「作ったときのタスク名」と一緒に保存するのはなぜか。段階7を並べ替えたとき、陳腐化(「古い」)と `UNIT_MISMATCH` がそれぞれ何を知らせるかを説明できるか。
2. 段階8の検証で、承認を止めるもの(エラー)と止めないもの(警告)をどう分けたか。設計の不足を警告にとどめる理由を「手順書の上では決めない」原則から説明できるか。
3. `UNRESOLVED_CALL` を「段階6の関数と書き方だけが違う呼び出し」に限り、直す先を段階5にしたのはなぜか。段階6の `UNCALLED_LOGIC` との役割分担と、段階6で選ばなかった関数を指摘しない理由を説明できるか。
4. 段階8の指摘を、手順書がまだ無くても出すために、どこを変えたか(`validate_stage` と `_to_read`)。承認が今までどおり内容を要する理由も説明できるか。
5. 参照の展開を Phase 28 へ移した判断を、#17 の「今この Phase に実在の消費者がいるか」で説明できるか。

## 次のフェーズ

**Phase 28**: 手順書の生成(参照の展開・単位ごとの AI の下書き(上限5)・AI の指摘・単位の詳細の表示・最重要が残るときの承認前の確認)。着手時に自動実装モード(#21)と [25-4](../Phase-25/Phase-25-4.md) の Phase 28 の未確定事項(「AI に提案を求める」をこの Phase で作るか)を決める。
