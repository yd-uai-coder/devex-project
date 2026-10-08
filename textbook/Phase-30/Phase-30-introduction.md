# Phase 30 導入: 実装手順書の出力(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の5つ目の実装 Phase。Phase 26〜29 で段階8の model・検証・生成・シーケンス図までできたが、手順書を外へ出す手段がまだ無かった。[25-1](../Phase-25/Phase-25-1.md) の決定6(AI 向けの出力は zip と画面の両方)・決定12(同じ zip に html+md)と、[作成方針](../../appendix/devex_implementation_procedure_guideline.md) 15・17・18章のとおりに出力を作る。

- **zip**: 詳細設計書・実装計画の zip に `implementation_procedure/` を加える。中身は `index.md`(概要・前提・単位の一覧・未定義の一覧・完了条件)、単位ごとの md(人向け)、`ai/<単位ID>.md`(AI 向けの版)、自己完結の HTML 1枚。
- **画面**: 段階8の単位の詳細に「AI 向けにコピー」を置く。中身は zip の AI 向けの版と同じ組み立て。
- **未承認・古いとき**: zip は段階8が承認済みのときだけ手順書を組み立てる。画面のコピーは保存済みの手順書から作り、警告する。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-1](../Phase-25/Phase-25-1.md)(決定6・12)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 30 の範囲と未確定事項)、見本 [`appendix/implementation-procedure-sample/`](../../appendix/implementation-procedure-sample/README.md)(`index.md`・単位の md・`ai/M-03-T01.md`)、[Phase 28-1](../Phase-28/Phase-28-1.md)(参照の展開をバックエンドだけに置いた理由)。
- 出力の土台は `devex-api` の `DetailedDesignExportService`([Phase 22](../Phase-22/Phase-22-introduction.md)・[Phase 23](../Phase-23/Phase-23-introduction.md))と `app/detailed_design/document/`(md・HTML の部品)。参照の展開は `procedure_doc_refs.unit_context`([Phase 28](../Phase-28/Phase-28-introduction.md)・[Phase 29](../Phase-29/Phase-29-introduction.md))。

```
[入力]   procedure_output_source(title, 段階8の状態, 段階1〜7, 段階8の手順書, 検証の指摘, 要件定義)  (30-1)
           → ProcedureOutputSource(単位・手順書・参照の展開・未定義・対象外)
[md]     to_index_markdown / to_unit_markdown / to_ai_markdown                                   (30-2)
[HTML]   to_procedure_html(単位を縦に並べる1ページ)                                              (30-3)
[zip]    DetailedDesignExportService.collect → procedure_files → implementation_procedure/       (30-4)
           (段階8の承認済みの内容だけ。未承認なら index と HTML に「未承認」)
[画面]   GET /design-stages/units/{unit_id}/ai-markdown → 「AI 向けにコピー」                   (30-5)
           (段階8の保存済みの内容から。未承認・古い・未定義の件数を警告)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す。この Phase では E2E の期待だけを直した。[30-4](./Phase-30-4.md))。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 30 の分と、モード・未承認のときの書き方を、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 30 開始時」)。

1. **自動実装モード**: on。
2. **HTML 1枚の構成**: 単位をタブにせず、縦に並べる。一覧の単位の ID から、その単位の手順書へアンカーで移る(実装計画の HTML と同じ形。30-3)。
3. **AI 向けの版の置き場**: `implementation_procedure/ai/<単位ID>.md`(見本と同じ別フォルダ。画面のコピーと同じ中身。30-2・30-4)。
4. **未承認・古いとき**: zip は段階8が承認済み(古くない)のときだけ組み立て、それ以外は `index.md` と HTML に「未承認」とだけ書く(詳細設計書の章と同じ規則)。画面のコピーは保存済みの手順書から作り、未承認・古いことと未定義の件数を警告する(止めない)(30-4・30-5)。

Claude の判断(計画の承認で確定):

- 組み立てはバックエンドだけ(参照の展開と同じ。#17)。画面のコピーは API で md を受け取る。デモの `toUnitMarkdown`・`toAiMarkdown` は本体へ移さない(30-5)。
- 単位の md と AI 向けの版は、手順書のある単位だけ(ID とタスク名の両方が段階7と合うもの)。index の一覧には全単位を載せ、無い単位は「(未生成)」(30-1・30-2)。
- 単位の未定義 = 段階8の検証の指摘(`unit` がその単位)+ AI の指摘。単位によらない検証の指摘は index の「全体」にだけ載せる。並びと数え方は画面の `collectFindings` と同じ(30-1)。
- 実装ルールは決定的に組み立てる(段階4の依存の1文 + 07章 + 段階7の開発環境)。対象外は要件定義の 1.4節の Should / Could / Won't(30-1・30-2)。
- ファイル名は `<単位ID>_<タスク名>.md`(パスに使えない文字と空白は `_`)(30-1)。
- 人向けの単位の md は、参照を ID(見出し)だけで書き、シーケンス図は添える(30-2)。

実装で計画から変えたこと:

- 組み立ての置き場を `document/` の中でなく、別パッケージ `app/detailed_design/procedure_output/` にした。参照の展開(`procedure_doc_refs`)が `document.markdown` を使うため、`document/__init__` から re-export すると循環する(30-1)。
- 単位の md に図だけを載せるため、参照の展開に Mermaid の本文の欄(`ExpandedRef.mermaid`)を足した。展開した md から図を切り出す処理を書かずに済む(30-2)。
- HTML で、参照の見出し(md 用で、パスを `` ` `` で囲む)の `` ` `` を除いた。ブラウザで描いて見つけた(30-3)。
- 要件定義の 1.4節の、中身の無い行(`Could have: `)を対象外に入れないようにした。簡易モードのテンプレートが空の行を持つため(30-1)。
- E2E の期待(帯の「段階1〜7はすべて承認済み」)が、段階8を数えるようにしたことで合わなくなるため、期待を「段階1〜8のうち 1 件が未承認」に直した(流すのは Phase 32。30-4)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-30-1.md`](./Phase-30-1.md) | 出力の入力と未定義の集約(`ProcedureOutputSource`) | あり(BE) | なし |
| [`Phase-30-2.md`](./Phase-30-2.md) | md の組み立て(index・単位の md・AI 向けの版) | あり(BE) | 30-1 |
| [`Phase-30-3.md`](./Phase-30-3.md) | HTML 1枚 | あり(BE) | 30-2(定数・`file_kind_label`) |
| [`Phase-30-4.md`](./Phase-30-4.md) | zip への追加とダウンロードの帯 | あり(BE・FE) | 30-1〜30-3 |
| [`Phase-30-5.md`](./Phase-30-5.md) | 画面の「AI 向けにコピー」(API と `AiCopyButton`) | あり(BE・FE) | 30-1・30-2(`to_ai_markdown`) |
| [`Phase-30-6.md`](./Phase-30-6.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 30-1〜30-5 |
| [`Phase-30-7.md`](./Phase-30-7.md) | 完了後の調整: ダウンロードを2つの zip に分け、承認まで押せなくする | あり(BE・FE) | 30-4 |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- `app/detailed_design/procedure_output/`(新規): `__init__.py`・`source.py`・`markdown.py`・`html.py`
- `app/detailed_design/procedure_doc_refs.py`・`app/detailed_design/document/html.py`
- `app/services/detailed_design_export_service.py`・`app/services/design_stage_service.py`・`app/services/errors.py`・`app/schemas/design_stage.py`・`app/api/routes/design_stages.py`
- テスト: `tests/fixtures/detailed_design.py`、`tests/unit/test_procedure_output_source.py`(新規)・`test_procedure_markdown.py`(新規)・`test_procedure_html.py`(新規)・`test_design_stage_ai_markdown.py`(新規)・`test_procedure_doc_refs.py`・`test_detailed_design_export.py`

`textbook/samples/frontend/` 配下:

- `src/features/detailed-design/`: `api/types.ts`・`api/designStagesApi.ts`・`procedureDocOps.ts`・`components/UnitProcedureEditor.tsx`・`components/ProcedureDocPanel.tsx`・`components/DesignDocumentBar.tsx`
- テスト: `src/features/detailed-design/__tests__/procedureDocOps.test.ts`、`api/__tests__/designStagesApi.test.ts`、`components/__tests__/UnitProcedureEditor.test.tsx`・`DesignDocumentBar.test.tsx`・`DetailedDesignPageContent.test.tsx`、`e2e/detailed-design-flow.spec.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [30-1](./Phase-30-1.md) | `procedure_output/source.py`・`__init__.py`・fixture | 出力の入力を1つにまとめ、未定義を画面と同じ規則で集める | 単位の並び・手順書のある単位だけ・未定義の並びと件数・対象外・ファイル名(純粋) |
| [30-2](./Phase-30-2.md) | `procedure_output/markdown.py`・`procedure_doc_refs.py` | index・人向けの単位の md・AI 向けの版を組み立てる | index の5節・未承認・ID だけで書く・17章の順と展開・警告(純粋) |
| [30-3](./Phase-30-3.md) | `procedure_output/html.py`・`document/html.py` | 単位を縦に並べた自己完結の HTML 1枚 | 決定的・アンカー・SVG・エスケープ・未承認(純粋) |
| [30-4](./Phase-30-4.md) | `detailed_design_export_service.py`・`DesignDocumentBar.tsx` | zip に `implementation_procedure/` を入れる(承認済みだけ) | zip の構成(未承認 / 承認済み。インメモリ DB)、帯の件数とボタン名 |
| [30-5](./Phase-30-5.md) | `design_stage_service.py`・`design_stages.py`・`UnitProcedureEditor.tsx` | 保存済みの手順書から AI 向けの md を返し、画面で写す | API の成功・404・409(インメモリ DB)、写す・警告・失敗・押せない条件(API とクリップボードをスタブ) |
| [30-6](./Phase-30-6.md) | `docs/*.md` | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意: `procedure_output/__init__.py` は 30-1・30-2・30-3 で触る(30-1 は `source` の名前だけ。samples ではタグで区別している)。fixture の `sample_procedure_source` は 30-1 で作り、30-2・30-3 のテストも使う。

実 import 監査(#15): 各章のファイルの import 先は、以前の Phase か、その章までにある。30-1 の `source.py` は `plan`・`procedure_doc`・`procedure_doc_refs`(Phase 26〜29)・`stages`・`validation.StageIssue`(Phase 15・27)・`uml.generation.sections.extract_section`(ステージ3)を読み、`document` は読まない。fixture は 30-1 の `procedure_output`(`ProcedureOutputSource`・`procedure_output_source`)と `validation.StageIssue` を読む。30-2 の `markdown.py` は `document.markdown.md_table`・`document.views.UNIT_KIND_LABELS`(Phase 22・26)・`procedure_doc_refs`(この章の `mermaid`)・30-1 の `source` を読む。30-3 の `html.py` は `document.html.page`(この章で改名)・30-2 の定数と `file_kind_label`・30-1 を読む。30-4 のサービスは 30-1〜30-3 の公開名と `validation.validate_stage` を、30-5 のサービスは 30-1・30-2 の公開名と 30-5 の `UnitAiMarkdownRead`・`DesignUnitProcedureNotFoundError` を読む。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`procedure_doc_refs.py` は `test_procedure_doc_refs.py`、`document/html.py` は `test_procedure_html.py` の `page`、`errors.py` の新しい例外は `test_design_stage_ai_markdown.py`、`ProcedureDocPanel.tsx` は既存の `ProcedureDocPanel.test.tsx` が描画する。E2E の spec は Phase 32 で流す)。

## 検証結果

- devex-api: 章ごとの関係するテスト(`test_procedure_output_source.py` 7件・`test_procedure_markdown.py` 8件・`test_procedure_html.py` 6件・`test_design_stage_ai_markdown.py` 4件ほか)。`ruff check`・`pyright` 成功。マイグレーションは無い。
- devex-ui: 詳細設計の feature 全体(`--maxWorkers=4`)・`tsc --noEmit`・eslint 成功。
- HTML は、fixture の内容で作ったものを Playwright で描いて確かめた(PC 幅とスマホ幅。参照の見出しの `` ` `` をここで見つけて直した)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 447 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 770 件成功(Phase 29 の 743 件 + 27 件)、`ruff check`・`pyright` 成功。
- devex-ui: 全体 616 件成功(Phase 29 の 610 件 + 6 件。`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。eslint は警告1件(既存の `src/features/hearing/api/__tests__/streamChat.test.ts`。この Phase では触っていない)。

## 未消化の申し送り(#37)

Phase 29 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **Phase 31 の未確定事項**: [25-4](../Phase-25/Phase-25-4.md)「未確定事項」(簡易モードの入口)。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **本番の段階7・段階8の移行**: 本番に反映するときは、マイグレーション `b8c9d0e1f2a3`(段階7をレビュー中に戻す)・`c9d0e1f2a3b4`(段階8の CHECK)を同じ順で流す。本番反映の手順は Phase 32 でまとめる。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **Phase 27〜29 の画面確認**: `UNRESOLVED_CALL` の文言とボタン、実 LLM での段階8の生成(手順書の中身・指摘の重要度と直す先)、単位の詳細の展開・編集、承認前の確認、実 LLM で段階5を下書きし直したときの種別の付き方、段階5のタブの図と指摘、詳細設計書の zip の 05章(HTML の図・md の Mermaid)、段階8の単位の詳細の図と `STUB_OUTSIDE_SEQUENCE` の出方を、ユーザーが確かめる(この Phase の画面確認と合わせて行える)。
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **偽 LLM の段階8**: `app/ai/llm/fake.py` に `ProcedureDocGenerationOutput` を登録し、段階1〜8の契約テストを Phase 32 で作る。
- **段階8の生成の入力の大きさ**(Phase 29 で発生): 手順の展開に Mermaid が入り、段階8の下書きのプロンプトが長くなった。問題になれば測る。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜30 はそれぞれ1セッション(着手時の相談 → 計画 → 実装と samples → docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **Phase 30 の未確定事項**([25-4](../Phase-25/Phase-25-4.md)): HTML 1枚は縦に並べる、AI 向けの版は `ai/<単位ID>.md`(着手時に決定)。
- **手順書の出力**(Phase 25 で発生): [30-1](./Phase-30-1.md)〜[30-5](./Phase-30-5.md)。

この Phase で生まれたもの:

- **画面確認**: 段階8を承認したプロジェクトで実装手順書の zip を落とし、中身(`index.md`・単位の md・`ai/*.md`・HTML)と見た目を、見本と比べて確かめる。2つのダウンロードのボタンが、承認されるまで透過して押せないこと(30-7)。単位の詳細の「AI 向けにコピー」(警告の文言、保存していない編集で押せないこと)と、写した md を実際の AI Coding Agent に渡したときの使い勝手を、ユーザーが確かめる。
- **E2E の期待の変更**: `e2e/detailed-design-flow.spec.ts` のボタン名・押せない実装手順書のボタン・zip の中身の期待を直した(30-4・30-7)。Phase 32 で全 E2E を流して確かめる。
- **出力の未定義の分類**: 未定義のうち「本来ヒアリングで聞くべきだった」ものを分類する仕組み([25-4](../Phase-25/Phase-25-4.md)「後続ステージへの申し送り」)は、この Phase では作っていない。ステージ6の着手時に、出力した `index.md` の未定義の一覧を材料にするかを決める。

## 完了後の調整

- **ダウンロードの分割**([30-7](./Phase-30-7.md)): zip を「詳細設計書・実装計画」(段階1〜7)と「実装手順書」(段階8)の2つに分け、元になる段階が承認されるまでボタンを押せなくした(透過表示。サーバーも409)。30-4 の「未承認なら index と HTML に『未承認』とだけ書く」zip は、この調整で出なくなった。
- 調整後の確認: devex-api ユニット全体 771 件成功・`ruff check`・`pyright` 成功。devex-ui 全体 619 件成功(`--maxWorkers=4`)・`npm run build` 成功(eslint は既存の警告1件)。`samples_check.py` 不一致 0・作り忘れ 0、`link_check.py` 切れ 0。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. zip は段階8が承認済みのときだけ手順書を組み立て、画面のコピーは保存済みの手順書から作るのはなぜか。2つが同じ組み立て関数を使い、入力(承認済み / 保存済み)だけが違うことと、詳細設計書の章の規則(承認していない内容を本文に出さない)から説明できるか。
2. 人向けの単位の md は参照を ID だけで書き、AI 向けの版は展開して添えるのはなぜか。作成方針の原則7(書き写さない)と15章(AI 向けは手順書の1単位を整形したもの)から説明できるか。シーケンス図だけは人向けにも載せる理由も。
3. 出力の組み立てを `document/` の中でなく別パッケージに置いたのはなぜか。import の循環がどこで起きるかを、`procedure_doc_refs` と `document.markdown` の関係から説明できるか。
4. 未定義の並びと件数の数え方を、画面の `collectFindings` とそろえたのはなぜか。そろえないと、どこで何が食い違うか。
5. 「AI 向けにコピー」を、保存していない編集があるときに押せなくしたのはなぜか。組み立てをサーバーに置いた判断とのつながりから説明できるか。

## 次のフェーズ

**Phase 31**: 簡易ドキュメントモードの手順書(実装計画書の WBS を縦割り・ID 付きに、簡易モードのプロジェクトで段階8だけを開く、参照先を内部設計書から引く、画面の入口)。着手時に自動実装モード(#21)と [25-4](../Phase-25/Phase-25-4.md) の Phase 31 の未確定事項(簡易モードの入口)を決める。
