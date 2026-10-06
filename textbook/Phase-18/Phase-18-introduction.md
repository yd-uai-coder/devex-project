# Phase 18 導入: 段階3 データモデル(ステージ4)

## 目的

詳細設計モードの段階3「データモデル」を、下書き → 編集 → 承認まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の3行目に当たる。入力は、承認済みの段階2(DFD・データ辞書・処理概要表)と段階1(機能一覧)である。

- **段階3の意味モデル**: CRUD 図のセル(処理 × テーブル、操作 C/R/U/D、下書きの印)だけ。ER とテーブル定義は持たない。
- **ER(全体1枚)**: `uml_diagrams` の行(notation=er、subject='')。SCR-007 のエディタで編集・自動レイアウト・承認する。
- **テーブル定義**: ER の列に足した制約・説明が正本。段階3の画面の表は ER から組み立てる表示だけ。
- **CRUD 図**: R(読み)と W(書き)は段階2の DFD の線の向きから決定的に作る。W の C/U/D の区別と、DFD を描いていない処理の分は AI が下書きし、人が確定する。
- **AI の下書きの生成**: 1回の生成で ER(LLM 1回)→ そのテーブルで CRUD 図(LLM 1回)を作る。1つのトランザクションで書く。
- **段階3の差し戻し**: ER を直したら、承認済みの段階3を「レビュー中」に戻す。

[Phase 14-4](../Phase-14/Phase-14-4.md) の Phase 18 の行(BE「ER・テーブル定義の生成、CRUD図(R/W を DFD の線の向きから決定的に作り、C/U/D と DFD に描いていない処理の分を AI が下書き)」、FE「テーブル定義・CRUD図のレビュー(下書きのセルを区別して表示し、人が確定)」、再利用「ER の意味モデル・生成・レイアウト(Phase 8〜12)」)に沿う。表に無いものとして、ER の編集による段階3の差し戻し(18-4)と、ER の属性パネルでの制約・説明の編集(18-6)を足した。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 18 開始時」を参照。

1. **ER は全体1枚**(`uml_diagrams`、subject='')。30要素を超えても、ステージ3の既存の警告だけにする。
2. **テーブル定義は ER が正本**。`ErColumn` に任意の `constraints`・`description`、`ErElement` に `description` を足す。テーブル定義の表は ER からの表示で、編集は ER のエディタの属性パネルで行う。
3. **CRUD の確定は承認で一括**。AI の下書きのセルは色で区別して警告に出す。人が書き換えたセルは下書きの印が外れ、段階3の承認で残りの印も外す。DFD の線から決まる R/W は固定(外せない)。
4. **段階3をまるごと1 Phase**(BE 4章+FE 5章)。一度「BE と FE で分ける」と答えた後、章の数(合わせて9章)を見て、1 Phase にまとめると決め直した。Phase の番号は送らない。

Claude の判断で決めたこと(計画の承認で確定):

- 段階3の `model` は `{cells: [{function_id, table, ops, draft}]}` だけ(18-1)。
- DFD のデータストアと ER のテーブルは、名前で突き合わせる(前後の空白を除いて小文字にする)。段階2で DFD を描くと選んだグループの DFD だけを使う(18-1)。
- 再生成は、AI の下書きと DFD の R/W で置き換える(前の版の人の確定は引き継がない)。ER も同じ行を上書きし、承認はやり直しになる(18-3)。
- 生成は LLM 2回(ER → CRUD)を1トランザクションで行う。段階2の `_save_group_dfd` を `_save_diagram` に共通化した(#17: 消費者は段階3の ER)(18-3)。
- ER の出力スキーマは段階3専用にし、簡易ドキュメントモードの ER のプロンプト・スキーマは変えない(18-2)。
- 段階3の画面に渡す DFD の R/W は、バックエンドが導いた結果を `DesignStageRead.dfd_accesses` で返す。画面で DFD を読み直して導き直さない(18-3)。

**計画からの変更(章の順)**: 計画では FE を「18-6 作業領域 → 18-7 属性パネル → 18-8 テーブル定義 → 18-9 CRUD 図」の順にしていた。しかし作業領域(`DataModelPanel`)を先に作ると、後の章の `crudOps`・`CrudMatrix`・`TableDefinitionTable` を前方 import する(#15)。そこで、部品を先に作り、作業領域を最後の 18-9 で組み立てる順に入れ替えた。章の数と中身は変わらない。

## パイプライン上の位置づけ・前提

```
段階3:  POST /design-stages/3/generate ─ 受け付け(生成中に)→ BackgroundTasks                  (18-3)
          execute: 段階1・2(承認済み)+ DFD の R/W(StageSources)+ data_items
                   → AI(ER)→ to_er_model → uml_diagrams(notation=er、subject='')を上書き     (18-2, 18-3)
                   → AI(CRUD。DFD の R/W は「決まったもの」として渡す)→ merge_crud           (18-1, 18-2)
                   → 1回だけ commit                                                          (18-3)
        GET /design-stages ─ issues(ER の状態・DFD との食い違い・下書きのセル)+ dfd_accesses  (18-1, 18-3)
        PUT /design-stages/3(CRUD 図の保存)
        ER の保存・自動レイアウト(SCR-007 の API)→ 承認済みの段階3を差し戻す                 (18-4)
        POST /design-stages/3/approve(エラーが無いこと = ER が承認済み)→ 下書きの印を外す   (18-3)
[FE]:   SCR-008 段階3 = DataModelPanel(生成・確認・保存)                                    (18-9)
                      + ErEditorSection(UmlDiagramEditor。属性パネルで制約・説明)             (18-6, 18-9)
                      + TableDefinitionTable(ER から表示)+ CrudMatrix(crudOps)             (18-7, 18-8)
```

- **前提として読むもの**:
  - [`Phase-17-introduction.md`](../Phase-17/Phase-17-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する2点(CRUD の R/W に DFD の線が要る・段階3の入力は段階2のデータストアとデータ辞書)。
  - [`Phase-17-1.md`](../Phase-17/Phase-17-1.md)・[`Phase-17-3.md`](../Phase-17/Phase-17-3.md)・[`Phase-17-4.md`](../Phase-17/Phase-17-4.md): 段階の外に正本を持つ図の扱い(要約で検証に渡す・1トランザクションの生成・図の編集で段階を差し戻す)。段階3は同じ形を ER で繰り返す。
  - [`Phase-17-7.md`](../Phase-17/Phase-17-7.md): SCR-007 のエディタの埋め込み(`UmlDiagramEditor`)。
  - [`appendix/detailed-design-devex/content.py`](../../appendix/detailed-design-devex/content.py) の `TABLES`・`TABLE_NOTES`・`CRUD` と、`build.py` の `crud_cells`: 段階3の見本(テーブル定義の制約・説明、DFD の線と CRUD 図の突き合わせ)。
- **本 Phase 開始時点の状態**:
  - 段階3の作業領域は「準備中」の表示だけだった。生成の対応表と検証の対応表には段階1・2しか無かった。
  - `StageSources.dfd_diagrams` は DFD の状態と処理IDだけで、線(R/W)を持っていなかった。
  - ER の列は、型・PK・FK・NULL可だけだった(テーブル定義の制約・説明を置く場所が無かった)。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、18-5 を納期モード、他を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-18-1.md`](./Phase-18-1.md) | BE: ER の列の拡張、段階3の意味モデル、DFD からの R/W の導出、CRUD 図の組み立て、段階3の検証(すべて純粋) | 学習 | なし |
| [`Phase-18-2.md`](./Phase-18-2.md) | BE: 段階3の下書きのプロンプトと出力スキーマ(ER・CRUD)、ER の意味モデルへの写像(純粋) | 学習 | 18-1 |
| [`Phase-18-3.md`](./Phase-18-3.md) | BE: 段階3の生成(2回の LLM・1トランザクション・`_save_diagram`)、段階の入力の拡張、承認で下書きを確定 | 学習 | 18-2 |
| [`Phase-18-4.md`](./Phase-18-4.md) | BE: ER の編集による段階3の差し戻し | 学習 | 18-3 |
| [`Phase-18-5.md`](./Phase-18-5.md) | FE: API・型(段階3の型、ER の列・テーブルの制約と説明、`dfd_accesses`) | 納期 | 18-4 |
| [`Phase-18-6.md`](./Phase-18-6.md) | FE: ER のエディタの属性パネルで、列の制約・説明とテーブルの説明を編集する | 学習 | 18-5 |
| [`Phase-18-7.md`](./Phase-18-7.md) | FE: テーブル定義の表(ER からの表示) | 学習 | 18-6 |
| [`Phase-18-8.md`](./Phase-18-8.md) | FE: CRUD 図の編集操作(純粋)と CRUD 図の表 | 学習 | 18-7 |
| [`Phase-18-9.md`](./Phase-18-9.md) | FE: 段階3の作業領域(生成・ER の埋め込み・保存)と、段階 → パネルの登録 | 学習 | 18-8 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{data_model,data_model_drafting}.py`
  - 新規(テスト): `tests/unit/test_{data_model,data_model_drafting}.py`
  - 更新: `app/uml/domain/er.py`、`app/detailed_design/{__init__,validation}.py`、`app/ai/llm/fake.py`、`app/schemas/design_stage.py`、`app/services/{design_stage_service,design_stage_generation_service,uml_diagram_service}.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{function_list,design_stage_generation,design_stage_reopen}.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/`):
  - 新規: `detailed-design/crudOps.ts`、`detailed-design/components/{TableDefinitionTable,CrudMatrix,ErEditorSection,DataModelPanel}.tsx`
  - 新規(テスト): `detailed-design/__tests__/crudOps.test.ts`、`detailed-design/components/__tests__/{TableDefinitionTable,CrudMatrix,ErEditorSection,DataModelPanel}.test.tsx`
  - 更新: `detailed-design/api/{types,designStagesApi}.ts`、`detailed-design/test-utils/stageFixtures.ts`、`detailed-design/components/{StageWorkArea,StageIssueList}.tsx`、`detailed-design/{labels,detailed-design-store}.ts`、`uml/components/UmlCanvas.tsx`、`uml/api/types.ts`、`uml/model/editOps.ts`、`uml/uml-editor-store.ts`、`uml/components/ElementInspector.tsx`
  - 更新(テスト): `detailed-design/api/__tests__/designStagesApi.test.ts`、`detailed-design/__tests__/{labels,detailed-design-store}.test.ts`、`detailed-design/components/__tests__/{StageWorkArea,StageIssueList,DataFlowPanel}.test.tsx`、`uml/components/__tests__/UmlCanvas.test.tsx`、`uml/api/__tests__/umlApi.test.ts`、`uml/model/__tests__/editOps.test.ts`、`uml/components/__tests__/ElementInspector.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 18-1 | `detailed_design/data_model.py`(新規)、`uml/domain/er.py`・`validation.py`・`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | 段階3の正本の形を決め、DFD の線から R/W を読み、CRUD 図を組み立て、ER の要約と R/W で段階3を検証する | `uv run pytest tests/unit/test_data_model.py tests/unit/test_function_list.py` |
| 18-2 | `detailed_design/data_model_drafting.py`(新規)、`fake.py`(更新) | ER(制約・説明つき)と CRUD 図を AI に書かせ、DFD から決まる部分は「決まったもの」として渡す | `uv run pytest tests/unit/test_data_model_drafting.py` |
| 18-3 | `schemas/design_stage.py`・`design_stage_service.py`・`design_stage_generation_service.py`・`tests/fixtures/detailed_design.py`(更新) | 段階3の生成を受け付けて裏で実行し、ER と CRUD 図を1回で書く。承認で下書きの印を外す | `uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_design_stage_service.py` |
| 18-4 | `uml_diagram_service.py`(更新) | ER の人の編集で、承認済みの段階3を差し戻す | `uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_uml_diagram_service.py` |
| 18-5 | `detailed-design/api/{types,designStagesApi}.ts`・`uml/api/types.ts`・`stageFixtures.ts`(更新) | 段階3の型・`dfd_accesses`・ER の制約と説明の型を足す | `npx vitest run src/features/detailed-design/api src/features/uml/api` |
| 18-6 | `uml/model/editOps.ts`・`uml/uml-editor-store.ts`・`uml/components/ElementInspector.tsx`(更新) | ER の属性パネルで、列の制約・説明とテーブルの説明を直せるようにする | `npx vitest run src/features/uml/components/__tests__/ElementInspector.test.tsx src/features/uml/model` |
| 18-7 | `components/TableDefinitionTable.tsx`(新規) | ER からテーブル定義の表を組み立てて表示する(編集しない) | `npx vitest run src/features/detailed-design/components/__tests__/TableDefinitionTable.test.tsx` |
| 18-8 | `crudOps.ts`・`components/CrudMatrix.tsx`(新規) | CRUD 図のセルを書き換える(DFD の R は外さない・印を外す)表 | `npx vitest run src/features/detailed-design/__tests__/crudOps.test.ts src/features/detailed-design/components/__tests__/CrudMatrix.test.tsx` |
| 18-9 | `components/{ErEditorSection,DataModelPanel}.tsx`(新規)、`StageWorkArea.tsx`(更新) | 段階3の作業領域を組み立て、生成・ER の埋め込み・CRUD 図の保存を持たせる | `npx vitest run src/features/detailed-design/components` |

## 写経順序(#23)

章番号順(18-1 → 18-2 → … → 18-9)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、2つの章で少しずつ完成する。各章の担当分には `# Phase-18-<n>:追記` / `# Phase-18-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `tests/fixtures/detailed_design.py`(18-1 → 18-3)

FE は、1つのファイルを複数の章で書き足さないように章の順を組んだ(上の「計画からの変更」)。

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 546件が成功(Phase 17 完了時は 526件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 503件(97ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **マイグレーション**: 不要(ER の列の追加は JSONB の中身で、既定値つき。段階3の model も JSONB)。
- **samples と本体の一致**: タグと旧コードのコメントを取り除いた samples を、本体と比べた。本 Phase で触ったファイルの差は、以前からあったコメントの違いだけである(`fake.py`・`uml_diagram_service.py`・`uml/api/types.ts`・`umlApi.test.ts`・`uml-editor-store.ts`・`StageWorkArea.tsx` の複数行の JSX コメントのタグ)。バックエンドの samples は Python 3.13 で構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた(FE の章の順を入れ替えた理由は上記)。各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた。18-3 の `app/schemas/design_stage.py`(`DfdAccessRead`)を章のテストが直接 import していなかったので、テストの比較を `DfdAccessRead` の値にした。
- **画面での確認**: 実装後にユーザーが画面で確かめ、4点を直した(図の未承認を承認時に出す・「テーブルを追加」の無限ループ・図の操作ボタンのダークモードの配色・同じ名前のテーブルによる CRUD 図の key の重複)。要望により、段階の承認の後に完了のダイアログと「次の段階へ進む」を足した。詳細は [`Phase-18-9.md`](./Phase-18-9.md)「画面確認後の修正」。修正後の FE 全体は 507件が成功。

## 後続 Phase への申し送り

- **段階4(Phase 19)**: モジュール一覧の「関わる処理」「依存先」の入力に、段階3の CRUD 図(処理 × テーブル)と ER を使う。CRUD 図は `design_stages.model`(段階3)の `cells`、ER は `uml_diagrams`(notation=er、subject='')。
- **組み立て(Phase 22)**: 03章のテーブル定義は ER の `columns[].constraints / description` と `elements[].description` から組み立てる。CRUD 図の記号は、出力見本(`build.py` の `crud_cells`)のように「DFD から決まる部分」と「人が確定した部分」を見分けられる形にするか、Phase 22 で決める(段階3の model は承認で下書きの印を外すので、承認後に残るのは DFD の R/W(`dfd_accesses`)との突き合わせだけ)。
- **データストア名の揺れ**: DFD のデータストアと ER のテーブルは名前で突き合わせる。名前が揃っていないと、検証の警告(`STORE_NOT_IN_ER`)が出て、その線は CRUD 図の固定部分にならない。AI には「データストアの名前をそのままテーブル名に使う」と指示しているが、人が DFD や ER を改名したときの追従はしていない。
- **既存のプロジェクト**: 段階3は新しく使えるようになっただけで、既存のデータの移行は無い。
- **開発環境への反映**: 開発用 DB には、Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用のまま(本 Phase はマイグレーションなし)。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 段階3の `model` に ER とテーブル定義を持たせず、CRUD 図のセルだけにしたのはなぜか。テーブル定義の制約・説明を ER の列に足したことで、何が二重にならずに済んだか。
2. CRUD 図の R と W を DFD の線の向きから決め、AI に決めさせる範囲を「C/U/D の区別」と「DFD を描いていない処理の分」に絞ったのはなぜか。AI が決まった部分を書き漏らしたとき、どこで補われるか。
3. 下書きの印(`draft`)は、いつ付き、いつ外れるか。「承認で一括確定」と「セルごとの確定」を比べ、前者を選んだ理由を説明できるか。
4. ER を直したときに承認済みの段階3を差し戻さないと、段階4で何が起きるか。段階2の DFD の差し戻し(17-4)と、どこが同じ仕組みか。
5. FE の章の順を「部品 → 作業領域」に入れ替えたのはなぜか(#15 の前方 import の禁止から説明する)。
