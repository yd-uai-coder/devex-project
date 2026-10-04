# Phase 22 導入: 詳細設計書の組み立てと出力(ステージ4)

## 目的

詳細設計モードで承認した段階1〜6から、詳細設計書(01〜06章)を組み立て、HTML・md・図をまとめた zip でダウンロードできるようにする。[`docs/implementation_plan.md`](../../docs/implementation_plan.md) のマイルストーン5「詳細設計モードで、段階1〜6を承認して詳細設計書(HTML+md)をダウンロードできる」を、本 Phase で達成する。

- **組み立て**: 承認済みの段階の意味モデルと図から、md と HTML を決定的に作る。文書としては保存しない(正本は段階の意味モデル。[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「4. 詳細設計モード」)。
- **HTML**: 自己完結の単一ファイルにする。レビュー画面と同じタブと双方向のリンク(05↔06・01 → 05・関与表 → 手順の行)を持ち、図は SVG を中に入れる。
- **md**: リンクと生の HTML を持たず、ID を本文に書く。図は zip の中の SVG を相対パスの画像で載せる。
- **図ファイル**: 載せた図の SVG・drawio(ステージ3の出力エンジンを使う)。
- **ダウンロード**: SCR-008 の上部のボタンから、いつでもダウンロードできる。

実務との対応: 日本の詳細設計書の本文(機能一覧〜処理ロジック)に当たる。arc42 の「Building Block View」(04)と「Runtime View」(05)も、同じ1冊に入る。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 22 開始時」を参照。3つとも推奨どおりに決まった。

1. **当初の Phase 22 を3つに分ける**。22 = 組み立てと出力、23 = 段階7 実装計画、24 = 統合/E2E・デプロイでの確認。番号の送り方は Phase 16・20 と同じ。段階7には生成も検証も画面もまだ無く、3つとも1 Phase では大きすぎるため。マイルストーン5は段階7を含まないので、Phase 22 で達成できる。
2. **07 横断事項は Phase 22 では出さない**。01〜06章は段階1〜6と1対1だが、07 の元になる段階のデータが無い(段階7は実装計画)。07 をどう作るかは Phase 23 で決める。内部設計書の章立てに保留の blockquote を入れた。
3. **ダウンロードはいつでもできる**。本文に組み立てるのは承認済みの段階だけ。未承認・未着手・古い段階の章には「未承認」とだけ書く。段階6が0件で承認済みなら、06章は「省略」と書く。

Claude の判断で決めたこと(計画の承認で確定):

- 組み立ては純粋関数のパッケージ `app/detailed_design/document/` に置く(22-1〜22-4)。DB の読み取り・図の描画・zip はサービスに置く(22-5)。内部設計書の「ステージ3の zip 出力と同じ層」に合わせた。
- 05↔06 の紐づけは、デモの `logic` 欄ではなく、手順の (callee, call) と段階6の `logic_key` の一致から導く(Phase 20 の決定。22-2)。
- CRUD 図の記号(Phase 18 からの持ち越し)は、DFD の線から決まる R / 書き込みは DFD から決まり区別は人が確定 / DFD に描いていない分で人が確定、の3つに分ける(出力見本 `appendix/detailed-design-devex` と同じ分け方。22-2)。
- 「関わる処理」の処理ID は圧縮しない(F-01〜F-04 のようにまとめない。Phase 19 からの持ち越し)。`all_functions` の行は「全処理」と書く。
- HTML の文字はすべてエスケープし、図の SVG だけはそのまま埋め込む(22-4)。
- 図の描画と zip の名前の重複除けは、ステージ3の `uml_sync_service` の中の関数を `app/uml/export/files.py` へ移して共有する(#17。22-5)。FE の `fetchAttachment` も `src/lib/api/download.ts` へ移す(22-6)。
- zip に入れた図は `exported` にする(ステージ3の zip と同じ)。出力済みの図も承認済みとみなすので、段階は差し戻されない。
- デモページ(`demo/`)の `toHtml`・`toMarkdown` は書式の見本として残す。

## パイプライン上の位置づけ・前提

```
GET /design-stages/document                                                          (22-5)
  DetailedDesignExportService.bundle
    DesignStageService.overview → 段階1〜7の状態 + 承認済みの段階の内容             (22-5)
    承認済みの章の図(段階2の DFD・段階3の ER・段階4の構成図)→ render_diagram(SVG・drawio)
    document_source(...) → DocumentSource(章の状態・承認済みの model・描画済みの図)  (22-1)
      views: 手順ID・L-ID・05↔06・関与表・データ辞書の使う処理・CRUD の記号        (22-2)
      to_markdown                                                                    (22-3)
      to_html                                                                        (22-4)
    zip: detailed_design.html / detailed_design.md / diagrams/*.svg|.drawio、図を exported に
[FE]:  SCR-008 上部 = DesignDocumentBar(ダウンロード・未承認の件数)                  (22-6)
         → designStagesApi.downloadDetailedDesign → fetchAttachment(共有)→ saveFile
```

- **前提として読むもの**:
  - [`Phase-21-introduction.md`](../Phase-21/Phase-21-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する2点(06章は `logics` から、0件の承認は「省略」)。
  - [`Phase-20-1.md`](../Phase-20/Phase-20-1.md): 手順番号・手順ID を保存しない理由(`number_steps`・`step_id`)。
  - [`Phase-21-1.md`](../Phase-21/Phase-21-1.md): L-ID と 05↔06 の紐づけを保存しない理由(`logic_id`・`logic_key`・`calling_steps`)。
  - [`Phase-13-introduction.md`](../Phase-13/Phase-13-introduction.md): ステージ3の zip(内部設計書の md+図)。描画と名前の重複除けを本 Phase で共通化する。
  - [`Phase-14-2.md`](../Phase-14/Phase-14-2.md): HTML と md の出力形式の決定(md にリンクを持たせない理由)。
- **本 Phase 開始時点の状態**:
  - 段階1〜6の作成画面はそろっていたが、詳細設計書を組み立てる手段が無かった。デモ(`toHtml`・`toMarkdown`)は 05・06 章だけで、手順の行の `logic` 欄を使う古い形だった。
  - 図の描画(`_render`)と zip の名前の重複除け(`_unique_base`)は、`uml_sync_service.py` の中だけの関数だった。

## モード宣言(#21)

- **22-6 を納期モード**にする。条件(a): API の口・ボタン・案内の文言で、定型が過半(`DiagramSyncBar` と同じ形)。条件(b): コアループ(チャット → 4文書生成)ではない付随作業。
- **残りの章は学習モード**。22-1・22-2 は「承認済みだけを本文にする」「保存しない値を画面と同じ規則で導く」という設計判断そのもの。22-3・22-4 は書き出しが大半だが、md にリンクを持たせない・SVG だけエスケープしない、という出力形式の判断を含む。22-5 は、共通化(#17)と図の状態の変化(exported)を含む。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-22-1.md`](./Phase-22-1.md) | BE: 組み立ての入力(`DocumentSource`)と章の状態(承認/省略/未承認)(純粋) | 学習 | なし |
| [`Phase-22-2.md`](./Phase-22-2.md) | BE: 表の導出(手順ID・L-ID・05↔06・関与表・データ辞書の使う処理・CRUD の記号)(純粋) | 学習 | 22-1 |
| [`Phase-22-3.md`](./Phase-22-3.md) | BE: md の組み立て(純粋) | 学習 | 22-2 |
| [`Phase-22-4.md`](./Phase-22-4.md) | BE: HTML の組み立て(タブ・バッジ・SVG の埋め込みとエスケープ)(純粋) | 学習 | 22-2 |
| [`Phase-22-5.md`](./Phase-22-5.md) | BE: 図の描画の共通化、出力サービス、ルート | 学習 | 22-3, 22-4 |
| [`Phase-22-6.md`](./Phase-22-6.md) | FE: ダウンロードの口(`fetchAttachment` の共通化)と SCR-008 のバー | 納期 | 22-5 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/document/{__init__,source,views,markdown,html}.py`、`app/services/detailed_design_export_service.py`
  - 新規(テスト): `tests/unit/test_detailed_design_document_{source,views,markdown,html}.py`、`tests/unit/test_detailed_design_export.py`
  - 更新: `app/uml/export/{files,__init__}.py`、`app/services/{uml_sync_service,design_stage_service}.py`、`app/api/routes/design_stages.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`
- **フロントエンド**(`textbook/samples/frontend/src/`):
  - 新規: `features/detailed-design/components/DesignDocumentBar.tsx`
  - 新規(テスト): `features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`
  - 更新: `lib/api/download.ts`、`features/uml/api/umlApi.ts`、`features/detailed-design/api/designStagesApi.ts`、`features/detailed-design/components/DetailedDesignPageContent.tsx`
  - 更新(テスト): `lib/api/__tests__/download.test.ts`、`features/detailed-design/api/__tests__/designStagesApi.test.ts`、`features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 22-1 | `document/{__init__,source}.py`(新規)、`tests/fixtures/detailed_design.py`(更新) | 段階の状態と内容から、章の状態と組み立ての入力をまとめる | `uv run pytest tests/unit/test_detailed_design_document_source.py` |
| 22-2 | `document/views.py`(新規)、`__init__.py`(更新) | 手順ID・L-ID・05↔06・関与表・データ辞書の使う処理・CRUD の記号を導く | `uv run pytest tests/unit/test_detailed_design_document_views.py` |
| 22-3 | `document/markdown.py`(新規)、`__init__.py`・fixture(更新) | 01〜06章の md を書き出す | `uv run pytest tests/unit/test_detailed_design_document_markdown.py` |
| 22-4 | `document/html.py`(新規)、`__init__.py`(更新) | 01〜06章の自己完結の HTML を書き出す | `uv run pytest tests/unit/test_detailed_design_document_html.py` |
| 22-5 | `uml/export/{files,__init__}.py`・`uml_sync_service.py`・`design_stage_service.py`・`design_stages.py`(更新)、`detailed_design_export_service.py`(新規)、fixture(更新) | 図を描き、md・HTML と一緒に zip にして返す | `uv run pytest tests/unit/test_detailed_design_export.py tests/unit/test_uml_sync_service.py tests/unit/test_uml_sync_routes.py` |
| 22-6 | `download.ts`・`umlApi.ts`・`designStagesApi.ts`・`DetailedDesignPageContent.tsx`(更新)、`DesignDocumentBar.tsx`(新規) | zip を受け取って保存させ、未承認の件数を知らせる | `npx vitest run src/lib/api src/features/detailed-design/api src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx src/features/uml/api`、`npx tsc --noEmit` |

## 写経順序(#23)

章番号順(22-1 → 22-2 → … → 22-6)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-22-<n>:追記` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/detailed_design/document/__init__.py`(22-1 → 22-2 → 22-3 → 22-4。章ごとに、その章で作るモジュールの re-export だけを足す)
- `tests/fixtures/detailed_design.py`(22-1 → 22-3 → 22-5。`document_stage_models`・`ALL_APPROVED` は 22-1、`sample_document_source` は 22-3、`create_document_project` は 22-5)

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 679件が成功(Phase 21 完了時は 646件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 612件(109ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **出力の確認**: 段階1〜6を承認した fixture(`create_document_project`)から zip を作って展開し、HTML をブラウザ(Playwright の chromium)で開いた。目次・章・タブ・図が表示され、`#l-01` を開くと 06 のタブが開き、06 の「↑ F-01#1」を押すと 05 の手順の行が強調された。スクリプトのエラーは無かった。HTML のテストでも、すべてのリンク先のアンカーがあることを確かめている。
- **マイグレーション**: 不要(新しいテーブル・列は無い)。
- **samples と本体の一致**: タグとコメントの行を取り除いた samples を、本体と比べた。本 Phase で触ったファイルに差は無い(JSX の中のタグのコメントを除く)。バックエンドの samples は Python 3.13 で、フロントエンドの samples は TypeScript のパーサで構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。
  - `source.py`(22-1)は `data_flow`・`data_model`・`function_list`・`logic`・`procedure`・`stages`・`structure`(以前の Phase)と `app.uml.domain.er` だけを import する。`views.py`(22-2)は `source` を使わず、以前の Phase のモジュールだけを import する。`markdown.py`(22-3)・`html.py`(22-4)は `source`(22-1)と `views`(22-2)を import し、互いには import しない。
  - `document/__init__.py` は章ごとに re-export を足す(22-1 は `source`、22-2 で `views`、22-3 で `to_markdown`、22-4 で `to_html`)。22-1 のテストと fixture が import するのは `source` の名前だけ。
  - fixture の `document_stage_models`・`ALL_APPROVED`(22-1)は既存の model の関数と `StageState` だけを、`sample_document_source`(22-3)は `source` の名前(22-1)と `ErSemanticModel` を、`create_document_project`(22-5)は `compute_layout`・`edge_labels`・`SemanticModelAdapter`(以前の Phase)を使う。
  - 出力サービス(22-5)は `document`(22-1〜22-4)・`render_diagram`・`unique_base`(22-5 の files.py)・`DesignStageService.overview`(22-5)を、ルート(22-5)は出力サービス(22-5)を import する。
  - FE: `designStagesApi.ts`(22-6)は `fetchAttachment`(22-6 の download.ts)を、`DesignDocumentBar.tsx`(22-6)は `downloadDetailedDesign`(22-6)を import する。
  - 各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた(22-2 の `__init__.py` の追記はテストの `from app.detailed_design.document import ...` で、22-5 の `uml_sync_service.py` はステージ3の zip のルートを通して確かめる)。
- **画面での確認**: ユーザーに依頼中。開発用 DB には Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用なので、先に `alembic upgrade head` が要る。

## 後続 Phase への申し送り

- **段階7 実装計画(Phase 23)**:
  - 段階7の生成・検証・作業領域を作る。入力は `STAGE_INPUTS[7]`(段階1〜6+要件定義・外部設計)。簡易ドキュメントモードの実装計画のプロンプト(`doc_generator_service.py`)は内部設計書を入力にするので、詳細設計モードでは何を渡すか(段階の model か、組み立てた md か)を決める。
  - 07 横断事項をどう作るか(段階7と同時に生成するか、別の段階にするか)を決める。決まったら `CHAPTERS` に足し、内部設計書の保留の blockquote を改める。
  - 段階7の成果物を zip に入れるか(詳細設計書の後ろに足すか、別のファイルにするか)を決める。
- **段階5の詳細バッジ**(Phase 21 からの持ち越し): 段階6が開いていないときに押すと「まだ始められません」になる。必要なら押せなくする。
- **関数名の書き方の揺れ**(Phase 21 からの持ち越し): 05 の `call` と 06 の `function` は完全一致でつなぐ。組み立てでも同じ規則で、揺れていると 05 に詳細のバッジが出ない。
- **統合/E2E・デプロイ(Phase 24)**: 詳細設計モードの E2E には、段階1〜7の偽の LLM の出力(`E2eFakeLLM`。段階7は未登録)と、図の自動レイアウトの操作が要る。開発用・本番の DB に、Phase 15・16 のマイグレーションを適用する。
- **ER の列の NULL**: ER の列の `nullable` の既定は「可」なので、主キーの列も表で「可」と出ることがある。段階3の下書きで主キーを NULL 不可にさせるか、組み立てで主キーを「不可」と出すかは、運用の後に判断する。

## 後続 Phase での改訂

- Phase 23: `CHAPTERS` に07章(横断事項。段階7)を足し、`to_markdown`・`to_html` に章を絞る `chapters` 引数を足した。出力サービスの入力の集め方を `collect(project, render=...)` に切り出し(段階7の生成が使う)、zip に `implementation_plan.{html,md}` を足した。fixture の `create_document_project` は段階1〜7の承認に改め、段階1〜6は `create_stage7_project` に分けた([Phase-23-introduction](../Phase-23/Phase-23-introduction.md))。

## Phase 完了チェック(#22)

1. 承認していない段階の章に、保存済みの途中の内容を出さず「未承認」とだけ書くことにしたのはなぜか。`StageSources.stages` が何を持つかと合わせて説明する。
2. 05 の手順の行と 06 の項目のリンクを、どの値の一致から導いているか。段階6が「省略」のとき、05 に「→ 詳細」が出ないのはなぜか。
3. md に章の間のリンクを持たせないのに、図は `![題](diagrams/x.svg)` で載せてよいとしたのはなぜか。
4. HTML の文字をすべてエスケープするのに、図の SVG だけそのまま埋め込むのはなぜか。もしエスケープすると何が表示されるか。
5. 図の描画(`render_diagram`)と名前の重複除け(`unique_base`)を `uml_sync_service` から `app/uml/export/files.py` へ移したのはなぜか。#17 の「この共通化を今駆動している消費者は何か」に答える。
