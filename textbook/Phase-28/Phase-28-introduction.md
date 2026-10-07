# Phase 28 導入: 手順書の生成(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の3つ目の実装 Phase。[Phase 27](../Phase-27/Phase-27-introduction.md) では、段階8の置き場・model・参照の導出(`unit_refs`)・決定的なチェックを作った。ただし段階8には生成器が無く、手順書を作れないので承認もできなかった。この Phase で手順書を作れるようにする。

- **参照の展開**: 単位が参照する設計(段階5の手順・段階6の関数・段階4のモジュール)と、段階7の 07章 横断事項・開発環境を md に展開する。バックエンドの純粋関数1か所にまとめ、生成の入力と画面の単位の詳細が同じものを使う。
- **手順書の下書き**: 人が選んだ単位を、1単位につき LLM を1回、1回に5つまで下書きする。設計に無いことは推測で埋めず、AI の指摘(重要度・直す先の段階)として挙げさせる。
- **単位の詳細の表示と編集**: 参照する設計の展開と、手順書の全部の欄を画面で編集できるようにする(AI の指摘の行の削除、単位の手順書の削除を含む)。
- **最重要が残るときの承認前の確認**: 段階8に最重要の指摘が残っていれば、件数を示して確かめてから承認する(承認は止めない)。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-1](../Phase-25/Phase-25-1.md)(決定3〜7・10)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 28 の範囲と未確定事項)、[Phase 27 の introduction](../Phase-27/Phase-27-introduction.md)(段階8の鍵・承認の条件・参照の導出)、見本の単位の md([`M-01-T02`](../../appendix/implementation-procedure-sample/implementation_procedure/M-01-T02_新規ユーザー登録を行う.md))とデモの `procedureDocModel.ts` の `expandRef`(`devex-ui/src/features/implementation-procedure/demo/`)。
- 生成の仕組みの正本は `devex-api` の `app/services/design_stage_generation_service.py`(受け付けとバックグラウンドの実行・`StageGenerationContext.targets`)。段階5・6の部分生成(`generation_targets`・`merge_*`)と同じ形にそろえる。

```
[展開] procedure_doc_refs.unit_context(unit, stages)                                         (28-1)
         unit_refs → expand_ref(05・06 と同じ表: procedure_table / logic_spec) + 07章・開発環境
       GET /design-stages/units/{unit_id}/context → UnitContextRead
[生成] POST /design-stages/8/generate {unit_ids?} → generate_procedure_docs                   (28-2)
         対象: 段階7の単位から(省略 = 手順書の無い単位)、上限5
         1単位: build_procedure_doc_messages(UnitContext) → LLM → to_unit_procedure → merge_unit_procedure
[画面] ProcedureDocPanel: 選択の列 + 「選んだ単位の手順書を生成する(n/5)」・作り直しの確認       (28-3)
       DetailedDesignPageContent: 最重要が残れば承認前に確認(criticalCount)
       UnitProcedureEditor: 参照のバッジ(展開)+ 手順書の編集、ProcedureDocPanel が保存     (28-4)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す)。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 28 の分と、承認の扱い・編集の範囲を、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 28 開始時」)。

1. **自動実装モード**: on。
2. **「AI に提案を求める」**: この Phase では作らない。指摘への対応は、今の「段階Nで直す」で設計の側へ移り、そこで直す・段階を再生成する。AI に案を出させる機能はステージ8(AI 設計レビュー・再ヒアリング)と役割が重なるので、その境界として申し送る。
3. **最重要が残るときの承認**: 確認のダイアログを出し、OK なら承認する。Phase 27 の決定「警告は承認を止めない」をそのまま保つ(28-3)。
4. **単位の詳細の編集**: 全部の欄を編集できる。AI の指摘は行の編集・削除ができ(設計を直して解消した指摘を消せる)、単位の手順書ごと削除もできる(`UNIT_MISMATCH` の片付けに使う)(28-4)。

Claude の判断(計画の承認で確定):

- **参照の展開はバックエンドだけに置く**(28-1)。使うのは、生成の入力(この Phase)・単位の詳細の表示(この Phase)・AI 向けの出力(Phase 30)。[25-1](../Phase-25/Phase-25-1.md) 決定6「zip と画面で中身は同じ」を、1か所の実装で守る(#17)。画面へは読み取り専用の API で渡し、デモの `expandRef` は FE へ移さない。
- **承認前の確認は FE だけで行う**(28-3)。バックエンドは承認を止めないので、`acknowledge` のような欄は足さない。
- **生成の対象**は、保存した model でなく承認済みの段階7の単位から決める。省略すると手順書の無い単位(段階5と同じ)(28-2)。
- **merge は対象の単位だけを置き換える**。段階7に無くなった単位の手順書は消さずに後ろへ置く(自動で付け替えない、という Phase 27 の決定を保つ)(28-2)。
- **AI の指摘の `fix_stage`** は 1〜7 から選ばせ、範囲の外は 8 にする(「段階Nで直す」を出さない)(28-2)。
- **偽 LLM の段階8の登録と段階1〜8の契約テスト**は、[25-4](../Phase-25/Phase-25-4.md) の計画どおり Phase 32 で行う。この Phase のテストは、テスト内の `FakeLLM` を使う。

実装で計画から変えたこと:

- 05・06 の表の組み立てを、詳細設計書の md(`document/markdown.py`)から `procedure_table`・`logic_spec` として切り出し、参照の展開と共有した(28-1。#17 ── 同じ表を2か所に書かない)。
- 計画では「他の段階から来たときは `focus` で単位を開く」としていたが、段階8へ単位を指して移る元がまだ無いので作らなかった(#17)。開いている単位は、ストアのタブの記憶(`"8:unit"`)で保存・生成の後も保つ(28-4)。
- 実装の要点・Given/When/Then・確認方法の入力欄は、`ListInput`(「,」区切り)でなく1行1項目の入力欄にした。文の中に「,」「、」が入るため(28-4)。
- samples の `ProcedureDocPanel.tsx` は大きく書き直したため、旧コードのコメントアウトを要所だけにした(28-3)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-28-1.md`](./Phase-28-1.md) | 参照の展開と、単位の参照の API | あり(BE) | なし |
| [`Phase-28-2.md`](./Phase-28-2.md) | 手順書の下書き(生成の対象・プロンプト・merge・生成器の登録) | あり(BE) | 28-1(`unit_context`・`find_unit`) |
| [`Phase-28-3.md`](./Phase-28-3.md) | 生成の操作と、最重要が残るときの承認前の確認 | あり(FE) | 28-2(`unit_ids`) |
| [`Phase-28-4.md`](./Phase-28-4.md) | 単位の詳細の表示と編集 | あり(FE) | 28-1(参照の API)、28-3 |
| [`Phase-28-5.md`](./Phase-28-5.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 28-1〜28-4 |

## サンプルコード一覧

`textbook/samples/backend/` 配下(28-1・28-2):

- `app/detailed_design/document/markdown.py`・`procedure_doc.py`・`procedure_doc_refs.py`(新規)・`procedure_doc_drafting.py`(新規)・`__init__.py`
- `app/schemas/design_stage.py`・`app/services/errors.py`・`app/services/design_stage_service.py`・`app/services/design_stage_generation_service.py`・`app/api/routes/design_stages.py`
- テスト: `tests/fixtures/detailed_design.py`、`tests/unit/test_procedure_doc_refs.py`(新規)・`test_procedure_doc_drafting.py`(新規)・`test_procedure_doc.py`・`test_design_stage_procedure_doc.py`・`test_design_stage_generation.py`

`textbook/samples/frontend/src/features/detailed-design/` 配下(28-3・28-4):

- `api/types.ts`・`api/designStagesApi.ts`・`detailed-design-store.ts`・`labels.ts`・`procedureDocOps.ts`
- `components/ProcedureDocPanel.tsx`・`DetailedDesignPageContent.tsx`・`UnitProcedureEditor.tsx`(新規)
- テスト: `api/__tests__/designStagesApi.test.ts`、`__tests__/detailed-design-store.test.ts`・`procedureDocOps.test.ts`、`components/__tests__/ProcedureDocPanel.test.tsx`・`DetailedDesignPageContent.test.tsx`・`UnitProcedureEditor.test.tsx`(新規)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [28-1](./Phase-28-1.md) | `procedure_doc_refs.py`・`markdown.py`・`procedure_doc.py`(`find_unit`)・`design_stage_service.py`・`design_stages.py` | 単位の参照を、05・06 と同じ表の md に展開して画面と生成に渡す | 参照の順と見出し、05・06 の表との一致、設計に無い参照は展開しない、基盤の単位は共通の節だけ(純粋)。API は開いていない段階8・段階7に無い単位を断る |
| [28-2](./Phase-28-2.md) | `procedure_doc_drafting.py`・`procedure_doc.py`(後半)・`design_stage_generation_service.py`・`design_stage.py`(schema) | 選んだ単位の手順書を1単位1回で下書きし、他の単位を残して merge する | プロンプトの節・変換と `fix_stage` の正規化・対象の決め方・merge の並び(純粋)。受け付けの断り(空・段階7に無い・5件超・段階8以外の指定)、`FakeLLM` での生成と承認、作り直しは `regenerated` |
| [28-3](./Phase-28-3.md) | `types.ts`・`designStagesApi.ts`・`detailed-design-store.ts`・`procedureDocOps.ts`・`ProcedureDocPanel.tsx`・`DetailedDesignPageContent.tsx` | 単位を選んで生成し、最重要が残れば承認前に確かめる | `criticalCount`・`toggleUnit`(純粋)、`unit_ids` を本文で渡す、選択と生成の呼び出し・作り直しの確認(`generate` をスタブ)、確認の OK で承認・キャンセルで承認しない |
| [28-4](./Phase-28-4.md) | `UnitProcedureEditor.tsx`・`procedureDocOps.ts`(編集)・`labels.ts`・`designStagesApi.ts`(`getUnitContext`)・`ProcedureDocPanel.tsx` | 参照を展開して見せ、手順書を編集して保存する | 編集の純粋関数、参照のバッジと展開・取得の失敗(API をスタブ)、編集で `onChange`、パネルの保存で `save` |
| [28-5](./Phase-28-5.md) | `docs/*.md` | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意: `procedure_doc.py`・`design_stages.py`(ルート)・`design_stage.py`(schema)・`__init__.py`・`test_design_stage_procedure_doc.py` は 28-1 と 28-2 の両方で触る。`types.ts`・`designStagesApi.ts`・`procedureDocOps.ts`・`ProcedureDocPanel.tsx` と、そのテストは 28-3 と 28-4 の両方で触る(samples ではタグで区別している)。

実 import 監査(#15): 各章のファイルの import 先は、以前の Phase か、その章までにある。28-1 の `procedure_doc_refs.py` は `procedure_doc`(Phase 27 の `unit_refs`・`design_index`・`PlanUnit`)と 28-1 で切り出した `markdown.procedure_table`・`logic_spec` を読む。28-2 の `procedure_doc_drafting.py` は 28-1 の `UnitContext` を、生成のサービスは 28-1 の `unit_context`・`find_unit` を読む。28-3 の `ProcedureDocPanel.tsx` が読む `UnitProcedureEditor` は 28-4 で作るので、写経では 28-3 の時点ではパネルの詳細の部分(`openedUnit` と `UnitProcedureEditor` の import)を書かず、28-4 で足す(samples ではタグで区別している)。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`errors.py` の `DesignUnitNotFoundError`・`labels.ts` の `UNIT_FILE_KIND_LABELS` は、テストから直接か、テストが描画する部品越しに読まれる)。

## 検証結果

- devex-api: 段階8のテスト(`test_procedure_doc_refs.py` 6件・`test_procedure_doc_drafting.py` 7件・`test_procedure_doc.py` 14件・`test_design_stage_procedure_doc.py` 12件)、ユニットテスト全体 705 件成功。`ruff check`・`pyright` 成功。マイグレーションは無い(model の形は Phase 27 のまま)。
- devex-ui: 詳細設計の feature 全体 246 件成功(`--maxWorkers=4`)。`tsc --noEmit`・eslint 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 432 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 705 件成功、`ruff check`・`pyright` 成功。
- devex-ui: 全体 596 件成功(`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。eslint は警告1件(既存の `src/features/hearing/api/__tests__/streamChat.test.ts`。この Phase では触っていない)。

## 未消化の申し送り(#37)

Phase 27 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **Phase 29〜31 の未確定事項**: [25-4](../Phase-25/Phase-25-4.md)「未確定事項」(種別の欄の付け方・05章の図の置き場・HTML 1枚の構成・簡易モードの入口)。
- **シーケンス図の本実装**: Phase 29([25-4](../Phase-25/Phase-25-4.md)・[25-5](../Phase-25/Phase-25-5.md))。単位の詳細に図を足す。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **本番の段階7・段階8の移行**: 本番に反映するときは、マイグレーション `b8c9d0e1f2a3`(段階7をレビュー中に戻す)・`c9d0e1f2a3b4`(段階8の CHECK)を同じ順で流す。本番反映の手順は Phase 32 でまとめる。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら Phase 29 以降で、各パネルに `focus` を読ませる。
- **Phase 27 の画面確認**: `UNRESOLVED_CALL` の文言とボタンを直した後の画面を、ユーザーが確かめる(この Phase の画面確認と合わせて行える)。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜28 はそれぞれ1セッション(着手時の相談 → 計画 → 実装と samples → docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **参照の展開と、最重要が残るときの承認前の確認**(Phase 27 で発生): 展開は [28-1](./Phase-28-1.md)、確認は [28-3](./Phase-28-3.md)。
- **Phase 28 の未確定事項**([25-4](../Phase-25/Phase-25-4.md)): 「AI に提案を求める」は作らないと着手時に決めた(上記)。

この Phase で生まれたもの:

- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。指摘のうち「本来ヒアリングで聞くべきだった」ものの分類([25-4](../Phase-25/Phase-25-4.md)「後続ステージへの申し送り」)と合わせて考える。
- **偽 LLM の段階8**: `app/ai/llm/fake.py` に `ProcedureDocGenerationOutput` を登録し、段階1〜8の契約テストを Phase 32 で作る(登録が無いまま E2E で段階8を生成すると、偽 LLM が `NotImplementedError` を出す)。
- **画面確認**: 実 LLM で段階8を生成し、手順書の中身(書き写していないか・指摘の重要度と直す先)、単位の詳細の展開・編集、承認前の確認を、ユーザーが確かめる。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 参照の展開をバックエンドだけに置き、画面へは API で渡したのはなぜか。生成の入力・単位の詳細・AI 向けの出力(Phase 30)の3か所と、[25-1](../Phase-25/Phase-25-1.md) 決定6の関係から説明できるか。
2. 生成の対象を、保存した model でなく承認済みの段階7から決めるのはなぜか。手順書の有無を「単位の ID とタスク名の両方」で判定する理由を、Phase 27 の `UNIT_MISMATCH` と結びつけて説明できるか。
3. merge で、段階7に無くなった単位の手順書を消さずに後ろへ置くのはなぜか。消すのは誰(どの操作)か。
4. 最重要が残っていても承認できるようにし、確認を FE だけで出したのはなぜか。「手順書の上では決めない」原則と、承認を止めたときに起きることから説明できるか。
5. AI の指摘の `fix_stage` を 1〜7 に限り、範囲の外を 8 にしたのはなぜか。外部設計・要件定義の不足を段階1に向ける理由も説明できるか。

## 次のフェーズ

**Phase 29**: シーケンス図(段階5の行の種別・導出の純粋関数・SVG と Mermaid・段階5の検証への指摘・05章と手順書の単位への表示)。着手時に自動実装モード(#21)と [25-4](../Phase-25/Phase-25-4.md) の Phase 29 の未確定事項(種別の欄を下書きに書かせるか・05章の図の置き場)を決める。
