# Phase 17 導入: 段階2 データフロー(ステージ4)

## 目的

詳細設計モードの段階2「データフロー」を、下書き → 編集 → 承認まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の2行目に当たる。入力は、承認済みの段階1(機能一覧)と要件定義書である。

- **段階2の意味モデル**: DFD を描く機能グループ(人が選ぶ。5つまで)と、全処理の処理概要表(入力/処理内容/出力)。DFD 本体とデータ辞書は持たない。
- **機能グループの DFD**: `uml_diagrams` の行(notation=dfd、subject=機能グループ名)。処理の箱は段階1の処理ID。SCR-007 のエディタで編集・自動レイアウト・承認する。
- **データ辞書**: プロジェクト共通の `data_items`。段階2の画面にデータ辞書の表を新しく作る。
- **AI の下書きの生成**: 1回の生成で、処理概要表(LLM 1回)と選んだグループの DFD(1グループで LLM 1回)を作る。1つのトランザクションで書く。
- **段階2の差し戻し**: DFD・データ辞書を直したら、承認済みの段階2を「レビュー中」に戻す。

[Phase 14-4](../Phase-14/Phase-14-4.md) の Phase 17 の行(BE「段階2の生成(機能グループごとの DFD、処理概要表)」、FE「DFD を描くグループの選択、処理概要表のレビュー」、再利用「DFD の意味モデル・検証・AI 生成・レイアウト・レビュー画面、`data_items`」)に沿う。表に無いものとして、データ辞書の表(17-8)と段階2の差し戻し(17-4)を足した。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 17 開始時」を参照。4つとも推奨どおりのユーザー回答である。

1. **DFD は `uml_diagrams` の行**(subject=機能グループ名)。SCR-007 のエディタを SCR-008 に埋め込む。段階2の承認は、選んだグループの DFD がすべて承認済みであることを条件にする。
2. **生成は「選んでから一括」**: DFD を描くグループを選んで保存 → 「下書きを生成」1回で、処理概要表と選んだグループの DFD を作る。選択の初期値は空。
3. **データ辞書は `data_items` を再利用**し、段階2の画面にデータ辞書の表を作る。
4. **Phase 17 は段階2をまるごと**(BE+FE)。

Claude の判断で決めたこと(計画の承認で確定):

- 段階2の `model` は `{dfd_groups, summaries}` だけ。再生成で `dfd_groups` は引き継ぎ、処理概要表は AI の結果で置き換える(AI が書き漏らした処理は前の版の行を残す)。選んだグループの DFD は同じ行を上書きし、承認はやり直しになる(17-1・17-3)。
- DFD の処理の箱は処理ID。AI には `function_id` だけを書かせ、ステージ3の出力スキーマに組み替えて写像を再利用する(17-2)。
- 一括生成は1トランザクション。1回で選べるグループは5つまで(17-3)。
- 生成の関数の引数を `StageGenerationContext` にまとめ、データ項目の名前の解決を `DataItemService.resolve_by_name` で共有する(17-3)。
- DFD・データ辞書の編集で承認済みの段階2を差し戻す(17-4)。計画では「DFD の意味モデルが変わった保存だけ」としていたが、DFD 自体が配置だけの保存・自動レイアウトでも承認をやり直す(M7)ので、それらでも差し戻すことにした。
- 自動レイアウトの上限(15秒)は据え置き、案C(レーン分離)は実施しない(下の「検証結果」の計測)。

## パイプライン上の位置づけ・前提

```
段階2:  PUT /design-stages/2(DFD を描くグループの選択を保存)                            (17-6)
        POST /design-stages/2/generate ─ 受け付け(上限の確認・生成中に)→ BackgroundTasks    (17-3)
          execute: 段階1(承認済み)+要件定義書 → AI(処理概要表)→ merge_summaries       (17-1, 17-2)
                   → グループごとに AI(DFD)→ to_dfd_output → resolve_by_name → to_dfd
                   → uml_diagrams(subject=グループ名)を上書き → 1回だけ commit            (17-2, 17-3)
        GET /design-stages ─ issues(処理概要表の過不足・DFD の有無・承認)                 (17-1, 17-3)
        DFD の保存・承認(SCR-007 の API)/ データ項目の CRUD → 承認済みの段階2を差し戻す    (17-4)
        POST /design-stages/2/approve(エラーが無いこと = DFD がすべて承認済み)
[FE]:   SCR-008 段階2 = DataFlowPanel(グループの選択・生成・処理概要表)                    (17-5, 17-6)
                      + DfdEditorTabs(UmlDiagramEditor を1枚ずつ)+ DataDictionaryTable     (17-7, 17-8)
```

- **前提として読むもの**:
  - [`Phase-16-introduction.md`](../Phase-16/Phase-16-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する3点(DFD の入力の切り替え・`STAGE_GENERATORS`/`STAGE_VALIDATORS` への登録・自動レイアウトの上限と案C)。
  - [`Phase-16-3.md`](../Phase-16/Phase-16-3.md)・[`Phase-16-4.md`](../Phase-16/Phase-16-4.md): 段階の検証の登録と、下書きの生成の受け付け・実行。段階2はここに登録する。
  - [`Phase-10-introduction.md`](../Phase-10/Phase-10-introduction.md): DFD の出力スキーマ・データ項目の名前の解決。段階2はこれを再利用する。
  - [`appendix/detailed-design-devex/content.py`](../../appendix/detailed-design-devex/content.py) の `DFDS`・`DATA_ITEMS`・`SUMMARY`: 段階2の見本(処理の箱が処理ID、グループごとの DFD、処理概要表)。
- **本 Phase 開始時点の状態**:
  - 段階2の作業領域は「準備中」の表示だけだった。生成の対応表と検証の対応表には段階1しか無かった。
  - DFD の生成は、内部設計書の `#### DF-n` 節を対象にしていた(詳細設計モードには内部設計書が無い)。
  - 画面には、データ辞書を編集する場所が無かった。

## モード宣言(#21)

- **17-5 を納期モード**にする。条件(a): 型と API クライアントの拡張で、定型が過半。条件(b): コアループ(チャット → 4文書生成)ではない付随作業。
- **残りの章は学習モード**。
  - 17-1〜17-4 は、正本の分け方・処理の箱を処理IDにする判断・1トランザクションの一括生成・段階の外の正本の編集の伝え方という設計判断そのものだから。
  - 17-6〜17-8 は、保存してから生成させる・エディタを1枚ずつ開く・段階を取り直す、という画面側の判断を含むため。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-17-1.md`](./Phase-17-1.md) | BE: 段階2の意味モデル、処理概要表の組み立て、段階2の検証(すべて純粋) | 学習 | なし |
| [`Phase-17-2.md`](./Phase-17-2.md) | BE: 段階2の下書きのプロンプトと出力スキーマ、ステージ3の写像への組み替え(純粋) | 学習 | 17-1 |
| [`Phase-17-3.md`](./Phase-17-3.md) | BE: 段階2の下書きの生成(文脈オブジェクト・1トランザクション・名前の解決の共有・段階の入力の拡張) | 学習 | 17-2 |
| [`Phase-17-4.md`](./Phase-17-4.md) | BE: DFD・データ辞書の編集による段階2の差し戻し | 学習 | 17-3 |
| [`Phase-17-5.md`](./Phase-17-5.md) | FE: API・型(段階2の型、データ辞書の作成・更新・削除) | 納期 | 17-4 |
| [`Phase-17-6.md`](./Phase-17-6.md) | FE: 段階2の作業領域(グループの選択・生成・処理概要表)、部品の切り出し、段階 → パネルの対応 | 学習 | 17-5 |
| [`Phase-17-7.md`](./Phase-17-7.md) | FE: 機能グループの DFD のタブ(SCR-007 のエディタの切り出しと埋め込み) | 学習 | 17-6 |
| [`Phase-17-8.md`](./Phase-17-8.md) | FE: データ辞書の表 | 学習 | 17-7 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{data_flow,data_flow_drafting}.py`
  - 新規(テスト): `tests/unit/test_{data_flow,data_flow_drafting,design_stage_reopen}.py`
  - 更新: `app/detailed_design/{__init__,validation}.py`、`app/ai/llm/fake.py`、`app/services/{data_item_service,uml_generation_service,design_stage_service,design_stage_generation_service,uml_diagram_service,errors}.py`、`app/api/routes/design_stages.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{function_list,design_stage_generation}.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/`):
  - 新規: `detailed-design/{dataFlowOps,dataDictionaryOps}.ts`、`detailed-design/components/{tableStyles.ts,StageIssueList.tsx,DataFlowPanel.tsx,DfdEditorTabs.tsx,DataDictionaryTable.tsx}`、`uml/components/UmlDiagramEditor.tsx`
  - 新規(テスト): `detailed-design/__tests__/{dataFlowOps,dataDictionaryOps}.test.ts`、`detailed-design/components/__tests__/{StageIssueList,DataFlowPanel,DfdEditorTabs,DataDictionaryTable}.test.tsx`
  - 更新: `detailed-design/api/{types,designStagesApi}.ts`、`detailed-design/test-utils/stageFixtures.ts`、`detailed-design/components/{FunctionListPanel,StageWorkArea}.tsx`、`uml/api/{types,umlApi}.ts`、`uml/components/UmlDiagramPageContent.tsx`
  - 更新(テスト): `detailed-design/api/__tests__/designStagesApi.test.ts`、`detailed-design/components/__tests__/StageWorkArea.test.tsx`、`uml/api/__tests__/umlApi.test.ts`、`uml/components/__tests__/UmlDiagramPageContent.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 17-1 | `detailed_design/data_flow.py`(新規)、`validation.py`・`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | 段階2の正本の形を決め、処理概要表を組み立て、DFD の要約も見て段階2を検証する | `uv run pytest tests/unit/test_data_flow.py tests/unit/test_function_list.py` |
| 17-2 | `detailed_design/data_flow_drafting.py`(新規)、`fake.py`(更新) | 処理概要表とグループの DFD を AI に書かせ、ステージ3の出力スキーマに組み替える | `uv run pytest tests/unit/test_data_flow_drafting.py` |
| 17-3 | `data_item_service.py`・`uml_generation_service.py`・`design_stage_service.py`・`design_stage_generation_service.py`(更新) | 段階2の生成を受け付けて裏で実行し、段階・DFD・データ項目を1回で書く | `uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_uml_generation_service.py tests/unit/test_design_stage_service.py` |
| 17-4 | `design_stage_service.py`・`uml_diagram_service.py`・`data_item_service.py`(更新) | DFD・データ辞書の人の編集で、承認済みの段階2を差し戻す | `uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_data_item_service.py tests/unit/test_uml_diagram_service.py` |
| 17-5 | `api/types.ts`・`designStagesApi.ts`・`uml/api/{types,umlApi}.ts`・`stageFixtures.ts`(更新) | 段階2の型とデータ辞書の API を足す | `npx vitest run src/features/detailed-design/api src/features/uml/api` |
| 17-6 | `tableStyles.ts`・`StageIssueList.tsx`・`dataFlowOps.ts`・`DataFlowPanel.tsx`(新規)、`FunctionListPanel.tsx`・`StageWorkArea.tsx`(更新) | グループを選んで保存してから生成させ、処理概要表を編集・保存する | `npx vitest run src/features/detailed-design/__tests__/dataFlowOps.test.ts src/features/detailed-design/components` |
| 17-7 | `UmlDiagramEditor.tsx`・`DfdEditorTabs.tsx`(新規)、`UmlDiagramPageContent.tsx`・`DataFlowPanel.tsx`(更新) | グループの DFD を SCR-007 のエディタで1枚ずつ開き、段階の状態と承認を合わせる | `npx vitest run src/features/detailed-design/components src/features/uml/components` |
| 17-8 | `dataDictionaryOps.ts`・`DataDictionaryTable.tsx`(新規)、`DataFlowPanel.tsx`(更新) | データ辞書を行ごとに編集・保存し、段階とエディタを取り直す | `npx vitest run src/features/detailed-design` |

## 写経順序(#23)

章番号順(17-1 → 17-2 → … → 17-8)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-17-<n>:追記` / `# Phase-17-<n>：更新` のタグ(JSX の中は `{/* Phase-17-<n>:追記 */}`)を付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/services/data_item_service.py`・`app/services/design_stage_service.py`(17-3 → 17-4)
- `components/DataFlowPanel.tsx`・`components/__tests__/DataFlowPanel.test.tsx`(17-6 → 17-7 → 17-8)

`uml/components/UmlDiagramPageContent.tsx`(17-7)は、中身を `UmlDiagramEditor.tsx` へそのまま移したので、移した旧コードを sample のコメントに残していない(同じコードが `UmlDiagramEditor.tsx` にある)。

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 526件が成功(Phase 16 完了時は 504件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 479件(92ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。既定の並列数では、Phase 14 のデモのテスト(`DetailedDesignDemoPageContent.test.tsx`)が時間切れ(5秒)になることがある。単独・`--maxWorkers=4` では通る(既存の事象)。
- **マイグレーション**: 不要(テーブルの変更なし)。
- **自動レイアウトの計測(申し送りの回収)**: 出力見本のグループの DFD(処理の箱が処理ID)3枚で測った。

  | DFD | 要素・線 | 所要時間 | 交差 |
  |---|---|---|---|
  | プロジェクト・ヒアリング | 9要素・18本 | 16.2秒 | 5 |
  | 文書 | 7要素・11本 | 0.4秒 | 0 |
  | UML 図(生成・承認・出力) | 9要素・18本 | 16.6秒 | 4 |

  Phase 15 の計測(9要素・18本で約17秒、交差は旧方式より2〜3本多い)と同じ水準である。グループの DFD は処理別の DFD と同じ規模に収まるので、上限15秒は据え置き、案C(レーン分離)は実施しない。
- **samples と本体の一致**: タグと旧コードのコメント(JSX のコメントを含む)を取り除いた samples を、本体と比べた。本 Phase で触ったファイルの差は、以前からあったコメントの違いだけである(`fake.py`・`errors.py`・`uml_diagram_service.py`・`uml/api` の3ファイル)。バックエンドの samples は Python 3.13 で構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた(17-6 の `DataFlowPanel` は、17-7・17-8 の部品をタグの部分でだけ import する)。各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた。17-3 の `DataItemService.resolve_by_name` を章のテストが直接 import していなかったので、テストを1件足した。

## 後続 Phase への申し送り

- **段階3(Phase 18)**:
  - CRUD 図の R/W は、段階2の DFD の線の向きから作る。DFD の処理の箱が処理ID、データストアがテーブルの候補(英小文字の複数形)である。`StageSources.dfd_diagrams` は今は要約(状態と処理ID)だけなので、線と端の要素が要る。
  - 段階3の入力は「段階2のデータストア・データ辞書」。データ辞書は `data_items` から読む。
- **機能グループの改名**: 段階1で機能グループを改名すると、古い名前の DFD は残ったまま使われなくなる(新しい名前の DFD は無い状態になり、検証の `DFD_MISSING` で気づける)。図を引き継ぐ仕組みは作っていない。選択を外したグループの DFD も消さずに残す。
- **既存のプロジェクト**: 段階2は新しく使えるようになっただけで、既存のデータの移行は無い。
- **開発環境への反映**: 開発用 DB には、Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用のまま(本 Phase はマイグレーションなし)。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 段階2の `model` に DFD とデータ辞書を持たせず、`uml_diagrams`・`data_items` を正本にしたのはなぜか。その結果、検証にはどうやって DFD の状態を渡しているか。
2. DFD の処理の箱を処理IDにし、AI には `function_id` だけを書かせる理由を、段階3の CRUD 図から説明できるか。ステージ3の写像を再利用できたのはなぜか。
3. 一括生成を1トランザクションにした利点と代償は何か。グループを5つまでにした理由も説明できるか。
4. DFD やデータ辞書を直したときに承認済みの段階2を差し戻さないと、段階3で何が起きるか。配置だけの保存でも差し戻すことにした理由は何か。
5. 画面で、グループの選択を保存するまで生成を止め、DFD のエディタの未保存の編集でも段階の承認を止めたのはなぜか。エディタを1枚ずつ開く理由も説明できるか。
