# Phase 31 導入: 簡易ドキュメントモードの実装手順書(ステージ5)

## 目的

ステージ5(実装手順書 + 実装可能性チェック)の6つ目の実装 Phase。Phase 26〜30 で、詳細設計モードの段階8(model・検証・生成・シーケンス図・出力)ができた。[25-1](../Phase-25/Phase-25-1.md) の決定2・8 のとおり、同じ形の手順書を簡易ドキュメントモードでも作れるようにする。[作成方針](../../appendix/devex_implementation_procedure_guideline.md)の3・7・10・18章が示す形である。

- **作業単位**: 実装計画書のプロンプトを変え、4.2 の WBS を段階7と同じ縦割り・ID 付きの決まった書式で書かせる。サーバーがそれを段階7と同じ形に決定的に読む。
- **段階8だけを開く**: 簡易モードのプロジェクトは段階8だけを持ち、入力は4文書。参照は内部設計書(処理別データフロー `DF-<n>`・モジュール一覧・API 一覧・3.4節)から引く。
- **画面の入口**: SCR-005 の「実装手順書へ進む →」から、同じ SCR-008 を段階8だけで開く。

## パイプライン上の位置づけ・前提

- 前提として読むもの: [Phase 25-1](../Phase-25/Phase-25-1.md)(決定2・8)、[Phase 25-4](../Phase-25/Phase-25-4.md)(Phase 31 の範囲と未確定事項)、[作成方針](../../appendix/devex_implementation_procedure_guideline.md) 3章(モードの比較)・10章(簡易モードの参照先)。
- 段階8の部品は Phase 27〜30。`procedure_doc`(model・`unit_refs`)、`procedure_doc_refs`(`unit_context`)、`validation.validate_procedure_doc`、`procedure_doc_drafting`、`procedure_output/`、`DesignStageService`・`DesignStageGenerationService`・`DetailedDesignExportService` を使う。
- 簡易モードの4文書は `doc_generator_service`(Phase 2〜。内部設計書のモジュール一覧は Phase 15、処理別データフローは Phase 10 で足した)。

```
[文書]   実装計画書 4.2(WBS。決まった書式)              ── parse_wbs ──────────► PlanModel + WBS の指摘      (31-1)
         内部設計書 3.1〜3.4・外部設計書 2.6             ── parse_internal_design ► SimpleDesignBook           (31-2)
[土台]   procedure_basis(mode, stages, documents) → ProcedureBasis(plan・refs・context・labels・環境・ルール) (31-2)
           詳細設計モード: 段階7 + unit_refs / unit_context(今までどおり)
           簡易モード  : WBS + simple_unit_refs / simple_unit_context
[部品]   検証(エラーは共通・警告は直す先を文書で)・下書きの入出力・出力の組み立て(文言は labels)       (31-3)
[API]    段階は stage_inputs(mode)(簡易は段階8だけ・入力は4文書)、段階8の応答に mode・plan                  (31-4)
[画面]   SCR-005「実装手順書へ進む →」→ SCR-008(段階8だけ)。「〇〇書を直す(再生成)」→ SCR-005             (31-5)
```

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作る)。E2E は流さない(#36。Phase 32 で全 E2E を流す。この Phase では簡易モードの E2E に期待を足しただけ。[31-5](./Phase-31-5.md))。

## 着手時の相談で決めたこと

[Phase 25-4](../Phase-25/Phase-25-4.md)「未確定事項」の Phase 31 の分(簡易モードの入口)と、モード・作業単位の取り出し方・区切りを、着手時に決めた(4つとも推奨どおり。[`q_a.md`](../q_a.md)「Phase 31 開始時」)。

1. **自動実装モード**: on。
2. **入口**: SCR-005 に「実装手順書へ進む →」を置き、既存の SCR-008 を段階8だけのステッパーで開く(5つ目のタブ・専用の画面にはしない)。
3. **作業単位の取り出し**: 実装計画書の WBS を決まった書式で書かせ、純粋関数で決定的に解析する(構造化出力での生成・AI での抽出はしない)。崩れは指摘にし、直す先は実装計画書(再生成)。
4. **区切り**: 1 Phase(31-1〜31-6)、1セッション。

Claude の判断(計画の承認で確定):

- 段階8の部品がモードによらず作業単位と参照を受け取る土台 `ProcedureBasis`(`app/detailed_design/procedure_basis.py`)を作り、段階7を直接読んでいた7か所をここに寄せる(#17)。
- 簡易モードの段階の入力は `SIMPLE_STAGE_INPUTS = {8: 4文書}`。マイグレーションは無い。
- 単位の ID は並び順から導き、WBS に書かれた ID は突き合わせるだけ(違えば軽微の指摘)。
- 指摘の直す先は `fix_document`(4文書)で持ち、`fix_stage` は 8 のまま。エラー(承認を止める)は両モード共通の3つだけ。
- 参照の種類に `dataflow` を足す。DF の展開に、同じ API の 3.3・2.6 の行と、流れに出てくる 3.2 のテーブルを添える。

実装で計画から変えたこと:

- 偽 LLM(E2E 用)への簡易モードの段階8の出力の登録はしなかった。詳細設計モードの段階8もまだ登録しておらず、Phase 32 で両方をまとめて登録する(Phase 28 からの申し送り)。
- 単位が1つも読めない WBS は、行ごとの指摘を出さず `WBS_MISSING` だけを返すことにした(旧形式の計画書で指摘が並ぶだけになるため。31-3 の検証を書いたときに決めた)。
- `DesignStageService.read` は、呼び出し元を変えないように `project_id` を受け取るまま、中でプロジェクトを読み直してモードを決めることにした(31-4)。
- 実装手順書の zip は、詳細設計書の組み立て(`collect`)を通らない `procedure_source` で作ることにした(簡易モードには段階1〜7・図が無いため。31-4)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-31-1.md`](./Phase-31-1.md) | WBS の書式と解析(`parse_wbs`)・実装計画書のプロンプト・偽 LLM の文書 | あり(BE) | なし |
| [`Phase-31-2.md`](./Phase-31-2.md) | 内部設計書の解析・参照・段階8の土台(`ProcedureBasis`)・段階の入力 | あり(BE) | 31-1 |
| [`Phase-31-3.md`](./Phase-31-3.md) | 検証・下書き・出力の組み立て(直す先の文書・`labels`) | あり(BE) | 31-1・31-2 |
| [`Phase-31-4.md`](./Phase-31-4.md) | サービスと API(段階8だけ・`mode`・`plan`・zip) | あり(BE) | 31-2・31-3 |
| [`Phase-31-5.md`](./Phase-31-5.md) | 画面(SCR-005 の入口・段階8だけの SCR-008・文書へのリンク) | あり(FE) | 31-4 |
| [`Phase-31-6.md`](./Phase-31-6.md) | `docs/*.md` への反映 | `docs/`・`appendix/` 配下(文書のため #13/#15/#30 の対象外) | 31-1〜31-5 |
| [`Phase-31-7.md`](./Phase-31-7.md) | 完了後の調整: 簡易モードの参照の粒度(テーブル・モジュールの層)と、ステッパーの段階1〜7 | あり(BE・FE) | 31-2・31-3・31-5 |

## サンプルコード一覧

`textbook/samples/backend/` 配下:

- `app/detailed_design/simple_procedure/`(新規): `__init__.py`・`wbs.py`・`internal_design.py`・`refs.py`
- `app/detailed_design/procedure_basis.py`(新規)
- `app/detailed_design/`: `procedure_doc.py`・`api_list.py`・`stages.py`・`validation.py`・`procedure_doc_drafting.py`・`procedure_output/{source,markdown,html}.py`
- `app/services/`: `doc_generator_service.py`・`design_stage_service.py`・`design_stage_generation_service.py`・`detailed_design_export_service.py`、`app/schemas/design_stage.py`・`app/api/routes/design_stages.py`・`app/ai/llm/fake.py`
- テスト: `tests/fixtures/simple_procedure.py`(新規)・`tests/fixtures/detailed_design.py`、`tests/unit/test_simple_wbs.py`・`test_simple_internal_design.py`・`test_simple_procedure_refs.py`・`test_procedure_basis.py`・`test_simple_procedure_validation.py`・`test_simple_procedure_stage.py`(新規)、`test_doc_generator_service.py`・`test_fake_llm_e2e.py`・`test_detailed_design_stages.py`・`test_procedure_doc_drafting.py`・`test_procedure_output_source.py`・`test_procedure_markdown.py`・`test_procedure_html.py`・`test_design_stage_service.py`

`textbook/samples/frontend/` 配下:

- `src/features/detailed-design/`: `api/types.ts`・`labels.ts`・`procedureDocOps.ts`・`components/FixTargetButton.tsx`(新規)・`components/UnitProcedureEditor.tsx`・`components/ProcedureDocPanel.tsx`・`components/DesignDocumentBar.tsx`・`components/DetailedDesignPageContent.tsx`、`src/features/documents/components/DocumentsPageContent.tsx`
- テスト: `src/features/detailed-design/test-utils/stageFixtures.ts`、`__tests__/procedureDocOps.test.ts`、`api/__tests__/designStagesApi.test.ts`、`components/__tests__/ProcedureDocPanel.test.tsx`・`UnitProcedureEditor.test.tsx`・`DesignDocumentBar.test.tsx`・`DetailedDesignPageContent.test.tsx`、`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`、`e2e/devex-flow.spec.ts`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [31-1](./Phase-31-1.md) | `simple_procedure/wbs.py`・`doc_generator_service.py`・`fake.py` | WBS を決まった書式で書かせ、段階7と同じ形に決定的に読む | 書式どおり・旧形式・ID の食い違い・読めない行・Won't(純粋)、プロンプトの指示、偽の計画書が読める |
| [31-2](./Phase-31-2.md) | `simple_procedure/{internal_design,refs}.py`・`procedure_basis.py`・`stages.py` | 内部設計書から参照を引き、モードごとの作業単位・参照・文言を1つの土台にまとめる | 内部設計書の各節・DF の展開・詳細設計モードは今までと同じ・簡易モードの段階の入力と陳腐化(純粋) |
| [31-3](./Phase-31-3.md) | `validation.py`・`procedure_doc_drafting.py`・`procedure_output/` | 簡易モードのチェックと直す先の文書、下書きのプロンプト、出力の文言 | 指摘の種類と直す先(純粋)、簡易モードのメッセージと出力の型、index・AI 向けの版・HTML の文言 |
| [31-4](./Phase-31-4.md) | `design_stage_service.py`・`design_stage_generation_service.py`・`detailed_design_export_service.py`・`schemas/design_stage.py` | 簡易モードで段階8の一覧・保存・承認・生成・参照・AI 向けの版・zip を使えるようにする | 生成 → 承認 → zip、ほかの段階の 409、文書の再生成で「古い」(インメモリ DB と FakeLLM) |
| [31-5](./Phase-31-5.md) | `ProcedureDocPanel.tsx`・`UnitProcedureEditor.tsx`・`FixTargetButton.tsx`・`DocumentsPageContent.tsx` | SCR-005 から段階8だけの SCR-008 を開き、直す先の文書へ移る | 単位を `plan` から読む・文書へのリンク・zip は手順書だけ・入口(API とストアをスタブ) |
| [31-6](./Phase-31-6.md) | `docs/*.md`・作成方針 | 決定と実装の反映 | なし(文書の目視レビュー) |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

注意:

- `simple_procedure/__init__.py` は 31-1(`wbs` の名前だけ)と 31-2(`internal_design`・`refs`)で触る。`wbs.py` は 31-1 で作り、31-3 で単位が0件のときの返し方を直した。`procedure_doc.py` は 31-1(`DesignDocument`)・31-2(`dataflow`)・31-3(`AiFinding.fix_document`)で触る。どれも samples ではタグで区別している。
- `tests/fixtures/simple_procedure.py` は 31-1 で作り、31-2(内部設計書と4文書)・31-3(手順書と出力の入力)・31-4(プロジェクトと構造化出力)で足す。
- `design_stage_service.py`・`detailed_design_export_service.py` は、31-3 で `procedure_output_source` の呼び出しを詳細設計モードの土台に直し、31-4 でモード対応に書き換えた。samples は最終の形で、31-4 のタグを付けている(31-3 の時点の形は [31-3](./Phase-31-3.md) の「呼び出し元はこの章で詳細設計モードの土台を渡す」)。

実 import 監査(#15): 各章のファイルの import 先は、以前の Phase か、その章までにある。

- 31-1: `wbs.py` は `plan`(`Milestone`・`PlanModel`・`PlanTask`・`Priority`・`UnitKind`・`task_id`)・`procedure_doc`(この章の `DesignDocument` と `FindingLevel`)・`uml.generation.sections` を読む。`test_fake_llm_e2e.py` はこの章の `simple_procedure.parse_wbs` を読む。
- 31-2: `internal_design.py` はこの章で公開した `api_list.table_cells`・`is_separator_row` と、`structure.ModuleRow` を読む。`refs.py` は `procedure_doc_refs`(`ExpandedRef`・`UnitContext`。Phase 28)と `internal_design` を読む。`procedure_basis.py` は `simple_procedure`(31-1・31-2)と `stages.ProjectMode`(この章)を読み、`validation` は読まない。
- 31-3: `validation.py` は 31-2 の `procedure_basis` と 31-1 の `DesignDocument` を読む。`procedure_output/source.py` は 31-2 の `DETAILED_LABELS`・`ProcedureBasis`・`ProcedureLabels` を読む。fixture の `sample_simple_procedure_source` は 31-2 の `procedure_basis` と 31-3 の `validate_procedure_doc` を読む。
- 31-4: サービスは 31-2 の `stage_inputs`・`StageInputs` と 31-3 の公開名を読む。fixture の `create_simple_procedure_project` は既存の `create_detailed_project` を読む。
- 31-5: `FixTargetButton.tsx` はこの章の `DESIGN_DOCUMENT_LABELS`・`FixTarget` を読む。

章が作成・更新するファイルは、その章のテストが少なくとも1度 import する。たとえば次のとおり。

- `api_list.py` は `test_simple_internal_design.py` が import する。
- `procedure_doc.py` の `DesignDocument` は、31-1 の `wbs.py` を通して `test_simple_wbs.py` が読む。
- `doc_generator_service.py` は `test_doc_generator_service.py` と `test_fake_llm_e2e.py` が読む。
- 31-3 の呼び出し元の2つのサービスは、既存の `test_design_stage_ai_markdown.py`・`test_detailed_design_export.py` が通す。
- `routes/design_stages.py` は `test_simple_procedure_stage.py` が通す。
- `FixTargetButton.tsx` は `ProcedureDocPanel.test.tsx`・`UnitProcedureEditor.test.tsx` が描画する。

E2E の spec は Phase 32 で流す。

## 検証結果

- devex-api: 章ごとの関係するテスト。追加したテストは次のとおり。`ruff check`・`pyright` 成功。マイグレーションは無い。
  - `test_simple_wbs.py` 6件
  - `test_simple_internal_design.py` 3件
  - `test_simple_procedure_refs.py` 3件
  - `test_procedure_basis.py` 3件
  - `test_simple_procedure_validation.py` 5件
  - `test_simple_procedure_stage.py` 4件
  - 既存のファイルへの追加 8件
- devex-ui: 詳細設計と文書の feature(310件。`--maxWorkers=4`)・`tsc --noEmit`・eslint 成功。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 460 / 並び順のみ差 8 / 例外 5)。`link_check.py`: 切れ 0 件。

### Phase 完了時の確認

- devex-api: ユニットテスト全体 803 件成功(Phase 30 の 771 件 + 32 件)、`ruff check`・`pyright` 成功。
- devex-ui: 全体 626 件成功(Phase 30 の 619 件 + 7 件。`--maxWorkers=4`、1回目で全件成功)、`npm run build` 成功。
- 画面の確認(ブラウザ)は、まだしていない(下の「この Phase で生まれたもの」)。

## 未消化の申し送り(#37)

Phase 30 から引き継いだもの:

- **持ち越し(Phase 22 から)**:
  - 段階6が開いていないときの、05 の詳細バッジ
  - ER の主キーの NULL の表示
- **E2E を CI で流すか**: 未定([`retrospective-memo.md`](../retrospective-memo.md) に候補として記録済み)。
- **コミュニケーション図**: 後回し([25-5](../Phase-25/Phase-25-5.md))。
- **本番の段階7・段階8の移行**: 本番に反映するときは、マイグレーション `b8c9d0e1f2a3`(段階7をレビュー中に戻す)・`c9d0e1f2a3b4`(段階8の CHECK)を同じ順で流す。本番反映の手順は Phase 32 でまとめる。
- **「段階Nで直す」の移動先での強調**: 段階5は手順・処理を開くが、段階3・4・7は段階を開くだけ。必要なら各パネルに `focus` を読ませる。
- **Phase 27〜30 の画面確認**: ユーザーが確かめる(この Phase の画面確認と合わせて行える)。対象は次のとおり。
  - `UNRESOLVED_CALL` の文言とボタン
  - 実 LLM での段階8の生成(手順書の中身・指摘の重要度と直す先)
  - 単位の詳細の展開・編集と、承認前の確認
  - 実 LLM で段階5を下書きし直したときの種別の付き方
  - 段階5のタブの図と指摘
  - 詳細設計書の zip の 05章(HTML の図・md の Mermaid)
  - 段階8の単位の詳細の図と `STUB_OUTSIDE_SEQUENCE` の出方
  - 実装手順書の zip の中身と見た目(見本と比べる)
  - 2つのダウンロードのボタンが承認まで押せないこと
  - 「AI 向けにコピー」の警告と、写した md を AI Coding Agent に渡したときの使い勝手
- **「AI に提案を求める」**: ステージ8(AI 設計レビュー・再ヒアリング)との境界として申し送る。
- **偽 LLM の段階8**: `app/ai/llm/fake.py` に `ProcedureDocGenerationOutput` と、この Phase の `SimpleProcedureDocGenerationOutput` を登録する。段階1〜8 と簡易モードの段階8の契約テストを Phase 32 で作る。
- **段階8の生成の入力の大きさ**(Phase 29 で発生): 手順の展開に Mermaid が入り、段階8の下書きのプロンプトが長くなった。問題になれば測る。
- **E2E の期待の変更**: Phase 30 の `detailed-design-flow.spec.ts` の変更と、この Phase の `devex-flow.spec.ts` の簡易モードの入口から段階8まで。Phase 32 で全 E2E を流して確かめる。
- **出力の未定義の分類**: 未定義のうち「本来ヒアリングで聞くべきだった」ものを分類する仕組み([25-4](../Phase-25/Phase-25-4.md)「後続ステージへの申し送り」)は作っていない。ステージ6の着手時に、出力した `index.md` の未定義の一覧を材料にするかを決める。
- **セッションの区切りの記録**(#18 の見直しの材料): Phase 25〜31 はそれぞれ1セッション(着手時の相談 → 計画 → 実装と samples → docs → 教材)。全体テストは Phase 完了時だけ。

この Phase で解決したもの:

- **Phase 31 の未確定事項**([25-4](../Phase-25/Phase-25-4.md)「簡易モードの入口」): SCR-005 から SCR-008 を段階8だけで開く(着手時の決定2)。
- **簡易ドキュメントモードの手順書**(Phase 25 で発生): [31-1](./Phase-31-1.md)〜[31-5](./Phase-31-5.md)。

この Phase で生まれたもの:

- **画面確認**: ユーザーが確かめる。対象は次のとおり。
  - 簡易モードのプロジェクトで4文書を生成し直したときの、実 LLM の WBS(書式どおりに書くか。`WBS_FORMAT`・`WBS_ID_MISMATCH` がどれくらい出るか)
  - SCR-005 の「実装手順書へ進む →」と、段階8だけの SCR-008(見出し・帯・単位の一覧)
  - 実 LLM での簡易モードの手順書の生成(未定義の多さと「詳細設計モードで詰める」の勧め。31-7 の後は、DF を持たない単位にデータモデルが添わること・モジュールが層で展開されること)
  - 段階1〜7の押せない行と注記(31-7)
  - 「〇〇書を直す(再生成)」
  - 実装手順書の zip
- **生成済みの簡易モードのプロジェクト**: この Phase より前に生成した実装計画書(番号の無い WBS)と内部設計書(モジュール一覧の無いもの)は、段階8を開くと `WBS_MISSING`・`NO_MODULE_LIST` が出て単位が空になる。文書を再生成すると使える。移行の処理は作っていない。
- **WBS の書式の守られ方**: 実 LLM が書式から外れる(全角の括弧・ID の桁など)ことが多ければ、解析の許す揺れを広げるか、プロンプトの例を増やす。
- **DF の ID の振り直し**: 内部設計書を再生成すると `DF-<n>` が振り直されうる([`docs/internal_design.md`](../../docs/internal_design.md) 3.3節の処理IDの注記)。4文書は同じ回の生成でそろうので、段階8は「古い」になって作り直す流れで扱える。文書を1つずつ直す運用が出てきたら見直す。

## 完了後の調整

- **簡易モードの参照の粒度**([31-7](./Phase-31-7.md)): 開発環境の簡易モードのプロジェクトで試したところ、2つの問題が出たので直した。
  - AI が「テーブル定義が無い」と指摘した。DF の本文に名前の出るテーブルを拾い、DF を持たない単位には 3.2 のデータモデル全体を添えるようにした。
  - モジュールが一覧に無いという警告が多数出た。モジュールは層まで照合し、層に当たらないファイルは警告しないようにした。
  - 詳細設計モードの経路は変えていない。
- **ステッパーの段階1〜7**([31-7](./Phase-31-7.md)): 簡易モードのステッパーに、段階1〜7を「詳細設計モードのみ」の押せない行として並べ、注記を添えた。
- 調整後の確認:
  - devex-api: ユニット全体 807 件成功(+4)・`ruff check`・`pyright` 成功
  - devex-ui: 全体 627 件成功(+1。`--maxWorkers=4`)・`npm run build` 成功
  - `samples_check.py` は不一致 0・作り忘れ 0、`link_check.py` は切れ 0

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

1. 簡易モードの作業単位を、AI で抽出せずに、決まった書式の WBS を決定的に読んで作るのはなぜか。文書の ID と手順書の ID の関係と、書式の崩れをどこで直すか(実装計画書の再生成)から説明できるか。
2. 段階8の部品が段階7を直接読まず、`ProcedureBasis` から作業単位と参照を受け取るようにしたのはなぜか。分岐を7か所に書いた場合と比べて、#17 と、詳細設計モードの挙動を変えないことの確かめ方(`test_procedure_basis.py`)から説明できるか。
3. 簡易モードの指摘の直す先を `fix_stage` の値でなく、別の欄 `fix_document` で持つのはなぜか。`fix_stage` の意味(1〜7 = 段階、8 = 直す先が無い)を変えないことで、どこが変更なしで動くか。
4. 簡易モードでも、承認を止めるのを手順書そのもののエラーだけにしたのはなぜか。文書の不足(WBS の崩れ・モジュール一覧が無い)を警告にする理由を、作成方針 3章の「未定義が多く出ることをそのまま示す」から説明できるか。
5. 画面が作業単位を段階7の model でなく段階8の応答の `plan` から読むようにしたのはなぜか。簡易モードに段階7の行が無いことと、WBS の解析をどこに置いたかから説明できるか。

## 次のフェーズ

**Phase 32**: 統合/E2E・デプロイでの確認(偽 LLM に段階8(両モード)を登録し、段階1〜8 → zip と簡易モードの段階8の契約テスト、既存を含めた全 E2E(#36)、マイグレーション、本番反映の手順)。着手時に自動実装モード(#21)と E2E の宣言を決める。ステージ5の完了として、振り返り(#10)と decision digest(#24)をまとめる(#18 により別セッション)。
