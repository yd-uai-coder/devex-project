# Phase 23 導入: 段階7 横断事項と実装計画(ステージ4)

## 目的

詳細設計モードの最後の段階(段階7)を作る。段階7では、詳細設計書の **07 横断事項** と **実装計画** を、AI が下書きし、人が直して承認する。承認したものは、Phase 22 の zip に入る。

- **意味モデル**: 横断事項・マイルストーン(中にタスク)・開発環境・リスクの表を持つ。処理ID は段階1の ID で書き、検証で突き合わせる。ファイルの欄は「作成・変更するファイルの例」で、検証しない(画面確認後の決定)。
- **検証**: 無い処理ID はエラーにする。どのマイルストーンにも入らない処理は「計画の漏れ」として警告する。
- **生成**: Phase 22 の組み立てで、段階1〜6を詳細設計書の md(01〜06章)にして入力にする。LLM は2回呼ぶ(横断事項 → 実装計画)。
- **出力**: 07 横断事項は詳細設計書の中に入れる。実装計画は別のファイル(`implementation_plan.md`・`.html`)にして、同じ zip に入れる。
- **画面**: SCR-008 の段階7に、表の編集画面を置く。

実務との対応: 07 は日本の詳細設計書の「共通方針」(例外・認証・トランザクション・ログ)、arc42 では「Cross-cutting Concepts」(8章)に当たる。実装計画は、簡易ドキュメントモードの実装計画書(4.1〜4.4)と同じ内容を、処理ID・モジュールと結びつけた表にしたもの。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 23 開始時」を参照。4つとも推奨どおりに決まった。

1. **段階7の model は構造化する**。Markdown 1本にはしない。表にすると、処理ID・パスを検証で突き合わせられ、他の段階と同じく md・HTML を model から組み立てられるため。
2. **07 横断事項は段階7で一緒に作る**。段階を1つ増やす案もあったが、段階の数は 1〜7 のままにした(マイグレーションも、ステッパーの改修も要らない)。段階7の名前は「横断事項と実装計画」に改めた。
3. **生成の入力は、組み立てた md にする**。簡易モードでは「要件定義+内部設計書」を入力にしている。詳細設計モードではそれに当たるものとして、Phase 22 の `to_markdown` が作る 01〜06章を渡す。
4. **実装計画は、同じ zip に別ファイルで入れる**。簡易モードでも実装計画書は別の文書なので、それとそろえた。未承認なら「未承認」とだけ書く(Phase 22 の章と同じ規則)。

Claude の判断で決めたこと(計画の承認で確定):

- タスクはマイルストーンの中に入れ子で持つ(着手時の見本では、タスクがマイルストーンの名前を持っていた)。名前で参照すると、改名したときに切れるため。WBS も本来は階層になっている(23-1)。
- マイルストーンの番号(`M-01`…)は保存しない。並び順から導く(L-ID と同じ考え方。23-1)。
- 計画の漏れ(どのマイルストーンにも入らない処理)はエラーにせず、警告にする。わざと次のリリースに回す処理もあるため(23-1)。
- ファイルの欄(`modules`)は検証しない。下書きのファイルは、段階5の呼び出し先と同じ規則(`resolve_callee`)で、当たるものだけモジュール一覧のパスにそろえる(23-1)。
  > **[Phase 23 で確定 ── 〈ファイルの欄をモジュール一覧と突き合わせない〉]** 当初〈横断事項とタスクのモジュールを段階4のモジュール一覧と突き合わせ、当たらなければエラー(`UNKNOWN_MODULE`)にする予定〉→ 撤回。理由〈画面確認で、AI の下書きの `Dockerfile`・`docker-compose.yml` のような環境・設定のファイルがエラーになった。これらは詳細設計のモジュール一覧に入らない。そこで、欄を「作成・変更するファイルの例」とし、表示はするが検証はしないことにした(ユーザーの決定。[`q_a.md`](../q_a.md)「Phase 23 画面確認後」)〉。
- `to_markdown`・`to_html` に `chapters` 引数を足す。段階7の生成は、01〜06章だけで呼ぶ(07 は段階7自身が作るため。23-2)。
- 組み立ての入力を集める処理は、出力サービスから `collect(project, render=...)` として切り出す(#17。今この共通化を必要としているのは、段階7の生成。23-3)。
- `ListInput`(「,」区切りの入力欄)は、段階4の `ModuleListTable` から切り出して共有する(#17。新しく使うのは段階7の表。23-6)。

## パイプライン上の位置づけ・前提

```
[段階7の生成] POST /design-stages/7/generate                                       (23-4)
  generate_plan
    DetailedDesignExportService.collect(project, render=False)   ← 図は描かない     (23-3)
      → DocumentSource → to_markdown(source, 01〜06章)                              (23-2)
    LLM ①: 要件定義・外部設計・詳細設計書 md → 横断事項                              (23-4)
    LLM ②: 要件定義・詳細設計書 md・横断事項・処理ID の一覧 → 実装計画                 (23-4)
    normalize_plan(モジュールをパスにそろえる) → PlanModel                         (23-1)
[保存・承認] validate_plan(STAGE_VALIDATORS[7])                                   (23-1)
[出力] GET /design-stages/document
  DetailedDesignExportService.bundle → collect(render=True)                         (23-3)
    detailed_design.{html,md}(07 横断事項を含む)・implementation_plan.{html,md}     (23-2)
[FE] SCR-008 の段階7 = PlanPanel(横断事項・マイルストーンとタスク・開発環境・リスク)  (23-5・23-6)
```

- **前提として読むもの**:
  - [`Phase-22-introduction.md`](../Phase-22/Phase-22-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する3点(段階7の入力、07 の作り方、zip に入れるか)。
  - [`Phase-22-1.md`](../Phase-22/Phase-22-1.md): 章の状態(承認/省略/未承認)と `DocumentSource`。本 Phase で07章を足す。
  - [`Phase-22-5.md`](../Phase-22/Phase-22-5.md): 出力サービス。本 Phase で入力の集め方を切り出す。
  - [`Phase-20-1.md`](../Phase-20/Phase-20-1.md): `resolve_callee`(AI の書いたモジュールをパスにそろえる規則)。
  - [`Phase-19-1.md`](../Phase-19/Phase-19-1.md): `module_ref_matches`(区切り単位の部分一致)。
- **本 Phase 開始時点の状態**:
  - 段階7には、生成・検証・画面が無かった。ステッパーで選ぶと「準備中」と出た。
  - 詳細設計書は 01〜06章だけだった。07 は内部設計書で「保留」になっていた。

## モード宣言(#21)

- **23-6 を納期モードにする**。条件(a): 表の入力欄の並びと配線が大半で、定型が過半(段階4の `StructurePanel` と同じ形)。条件(b): コアループ(チャット → 4文書生成)ではない付随作業。
- **残りの章は学習モードにする**。各章の中心になる判断は次のとおり。
  - 23-1: 入れ子・番号を保存しない・計画の漏れを警告にする、という model と検証の設計。
  - 23-2: 07 を詳細設計書に、実装計画を別ファイルにする、という出力の分け方。
  - 23-3: 共通化(#17)と、図を描かない入力の集め方。
  - 23-4: コアループの生成の入力の決め方そのもの。
  - 23-5: 番号を並び順から導く・タスクを入れ子で直す、という編集の規則。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-23-1.md`](./Phase-23-1.md) | BE: 段階7の意味モデル(横断事項・マイルストーン・タスク・リスク)と検証(純粋) | 学習 | なし |
| [`Phase-23-2.md`](./Phase-23-2.md) | BE: 組み立ての拡張(07章、実装計画の md・HTML、`chapters` 引数)(純粋) | 学習 | 23-1 |
| [`Phase-23-3.md`](./Phase-23-3.md) | BE: 組み立ての入力の切り出し(`collect`)と、zip への実装計画の追加 | 学習 | 23-2 |
| [`Phase-23-4.md`](./Phase-23-4.md) | BE: 段階7の下書き(プロンプト2本)と生成の登録 | 学習 | 23-3 |
| [`Phase-23-5.md`](./Phase-23-5.md) | FE: 段階7の型と編集操作(`planOps`)(純粋) | 学習 | なし(BE の model と同じ形) |
| [`Phase-23-6.md`](./Phase-23-6.md) | FE: `PlanPanel`・表、`ListInput` の切り出し、登録・名前・ダウンロードのバー | 納期 | 23-5 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/plan.py`、`app/detailed_design/plan_drafting.py`
  - 新規(テスト): `tests/unit/test_plan.py`、`tests/unit/test_detailed_design_plan_document.py`、`tests/unit/test_detailed_design_plan_export.py`、`tests/unit/test_plan_drafting.py`、`tests/unit/test_design_stage_plan_generation.py`
  - 更新: `app/detailed_design/{__init__,validation}.py`、`app/detailed_design/document/{__init__,source,views,markdown,html}.py`、`app/services/{detailed_design_export_service,design_stage_generation_service}.py`、`app/api/routes/design_stages.py`(docstring)、`app/ai/llm/fake.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_function_list.py`、`tests/unit/test_detailed_design_document_{source,markdown}.py`、`tests/unit/test_detailed_design_export.py`、`tests/unit/test_design_stage_generation.py`
- **フロントエンド**(`textbook/samples/frontend/src/`):
  - 新規: `features/detailed-design/planOps.ts`、`features/detailed-design/components/{ListInput,PlanTables,PlanPanel}.tsx`
  - 新規(テスト): `features/detailed-design/__tests__/planOps.test.ts`、`features/detailed-design/components/__tests__/{ListInput,PlanTables,PlanPanel}.test.tsx`
  - 更新: `features/detailed-design/api/types.ts`、`features/detailed-design/test-utils/stageFixtures.ts`、`features/detailed-design/labels.ts`、`features/detailed-design/components/{ModuleListTable,StageWorkArea,DesignDocumentBar}.tsx`
  - 更新(テスト): `features/detailed-design/components/__tests__/{StageWorkArea,DesignDocumentBar,DetailedDesignPageContent}.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 23-1 | `plan.py`(新規)、`validation.py`・`detailed_design/__init__.py`・fixture(更新) | 段階7の model・下書きの整え方・検証を決める | `uv run pytest tests/unit/test_plan.py tests/unit/test_function_list.py` |
| 23-2 | `document/{source,views,markdown,html,__init__}.py`、fixture(更新) | 07章と実装計画の md・HTML を組み立てる | `uv run pytest tests/unit/test_detailed_design_plan_document.py tests/unit/test_detailed_design_document_source.py tests/unit/test_detailed_design_document_markdown.py tests/unit/test_detailed_design_export.py` |
| 23-3 | `detailed_design_export_service.py`・`design_stages.py`(更新) | 入力の集め方を切り出し、zip に実装計画を足す | `uv run pytest tests/unit/test_detailed_design_plan_export.py tests/unit/test_detailed_design_export.py` |
| 23-4 | `plan_drafting.py`(新規)、`design_stage_generation_service.py`・`fake.py`・`design_stages.py`(更新) | 段階7を 01〜06章の md から下書きする | `uv run pytest tests/unit/test_plan_drafting.py tests/unit/test_design_stage_plan_generation.py tests/unit/test_design_stage_generation.py` |
| 23-5 | `api/types.ts`・`stageFixtures.ts`(更新)、`planOps.ts`(新規) | 段階7の model を画面で直す純粋関数 | `npx vitest run src/features/detailed-design/__tests__/planOps.test.ts` |
| 23-6 | `ListInput.tsx`・`PlanTables.tsx`・`PlanPanel.tsx`(新規)、`ModuleListTable.tsx`・`StageWorkArea.tsx`・`labels.ts`・`DesignDocumentBar.tsx`(更新) | 段階7の作業領域とダウンロードの件数 | `npx vitest run src/features/detailed-design/components`、`npx tsc --noEmit` |

## 写経順序(#23)

章番号の順(23-1 → 23-2 → … → 23-6)に進める。各章の中は依存順(#30)で、順番は各章の表を参照する。BE(23-1〜23-4)と FE(23-5・23-6)は import でつながらないので、FE から始めてもよい。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-23-<n>:追記` などのタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `tests/fixtures/detailed_design.py`(23-1 → 23-2)。23-1 で `plan_model` を足す。23-2 で `document_stage_models` に段階7を足し、`create_document_project` を `create_stage7_project`(段階1〜6を承認)と、新しい `create_document_project`(段階1〜7を承認)に分ける。07章が加わった時点で、Phase 22 の zip のテストが「07 未承認」を拾わないようにするため、23-2 で分ける。
- `app/api/routes/design_stages.py`(23-3・23-4。どちらも docstring だけ)

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは、本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 714件が成功した(Phase 22 完了時は 679件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)だけ。
- **FE(Phase 完了時の全体テスト)**: 全体 630件(113ファイル)が成功した(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。並列のままでは、詳細設計まわりの重いテストが時間切れになることがある(既知。1回目に1件、再実行で成功)。
- **出力の確認**: 段階1〜7を承認した fixture(`create_document_project`)から zip を作って展開した。中身は `implementation_plan.{html,md}` を含む。`implementation_plan.html` と `detailed_design.html` の07章を、ブラウザ(Playwright の chromium)で開いた。確かめた結果は次のとおり。
  - M-ID のバッジを押すと、そのマイルストーンの見出しへ移って強調される。
  - スクリプトのエラーは無い。
  - 幅 375px で横にはみ出さない。
- **マイグレーション**: 要らない(新しいテーブル・列は無い。段階7の行はもとから `design_stages` に入る)。
- **samples と本体の一致**: タグとコメントの行を取り除いた samples を、本体と比べた。本 Phase で触ったファイルに差は無い(JSX の中のタグのブロックコメントを除く)。BE の samples は Python 3.13 で、FE の samples は TypeScript のパーサで構文チェックした。
- **実 import 監査(#15)**: 章の順に、全ファイルの import 文を読んだ。前方 import は無い。
  - `plan.py`(23-1)は `procedure.resolve_callee`(Phase 20)だけを import する。`validation.py` の追記(23-1)は `plan`(23-1)を import する。
  - 23-2 の組み立ては、`plan`(23-1)と `views.function_plans`(23-2)を import する。fixture の分割(23-2)は、`plan_model`(23-1)と `DesignStageService`(以前の Phase)を使う。
  - 出力サービス(23-3)は、`to_plan_html`・`to_plan_markdown`・`DocumentSource`(23-2)を import する。
  - `plan_drafting.py`(23-4)は `plan`(23-1)・`function_list`・`prompt_rules`(以前の Phase)を import する。生成サービス(23-4)は `CHAPTERS`・`to_markdown`(22・23-2)・`plan`・`plan_drafting`・`DetailedDesignExportService.collect`(23-3)を import する。
  - FE: `planOps.ts`(23-5)は `types.ts`(23-5)を import する。`ListInput.tsx`(23-6)は `moduleListOps`(Phase 19)を、`PlanTables.tsx`(23-6)は `ListInput`(23-6)・`planOps`(23-5)を、`PlanPanel.tsx`(23-6)は `PlanTables`(23-6)を import する。
  - 各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた。docstring だけを直した `design_stages.py` は、23-3 のテストがダウンロードのルートを呼んで確かめる。23-6 の `ModuleListTable.tsx` は、既存の `ModuleListTable.test.tsx` が確かめる。
- **画面での確認**: ユーザーに依頼中。開発用 DB には Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用なので、先に `alembic upgrade head` が要る。

## 後続 Phase への申し送り

- **統合/E2E・デプロイ(Phase 24)**: 次のものがそろったので、詳細設計モードの E2E を通しで書ける。
  - 偽の LLM(`E2eFakeLLM`)の段階1〜7の出力。段階7は本 Phase で登録した。
  - 図の自動レイアウトの操作。
  - あわせて、開発用・本番の DB に Phase 15・16 のマイグレーションを適用する。
- **段階7の入力の大きさ**: 詳細設計書の md(01〜06章)を丸ごと渡す。処理や関数が多いプロジェクトでは、入力のトークン数が上限に近づくおそれがある。超えたときは、既存の `TOKEN_LIMIT` の理由で失敗を知らせる。問題になったら、05・06章を要約して渡す案を考える。
- **Phase 22 からの持ち越し(今回も扱わない)**: 次の3つ。
  - 段階6が開いていないときの、05 の詳細バッジ
  - `call` と `function` の書き方の揺れ
  - ER の主キーの NULL の表示

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. タスクをマイルストーンの名前で参照せず、マイルストーンの中に入れ子で持ったのはなぜか。M-ID を保存しないこととあわせて説明する。
2. 「どのマイルストーンにも入らない処理」を、エラーではなく警告にしたのはなぜか。無い処理ID はエラーにしたのに対し、何が違うか。また、ファイルの欄を検証しないことにしたのはなぜか。
3. 段階7の生成で、詳細設計書の md を 01〜06章だけにして渡すのはなぜか。07 を含めると何が起きるか。
4. `collect(project, render=False)` は、図を描かず、図を `exported` にもしない。それでも DFD と ER の意味モデルは読むのはなぜか(どの章の何に使うか)。
5. 07 横断事項は詳細設計書の中に入れ、実装計画は別のファイルにした。これは、簡易ドキュメントモードの4文書の分け方と、どう対応しているか。
