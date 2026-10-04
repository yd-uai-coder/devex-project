# Phase 19 導入: 段階4 ソフトウェア構造(ステージ4)

## 目的

詳細設計モードの段階4「ソフトウェア構造」を、下書き → 編集 → 承認まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の4行目に当たる。入力は、承認済みの段階1〜3(機能一覧・データフロー・データモデル)と、要件定義書(技術スタック)である。

- **構成図(層)**: `uml_diagrams` の行(notation=component、subject='')の1枚。箱はパッケージ単位で、層を図のレーンにする。SCR-007 のエディタで編集・自動レイアウト・承認する。
- **モジュール一覧**: ファイル単位の責務表(パス / 層 / 責務 / 主な依存先 / 関わる処理)。段階4の意味モデル(`design_stages.model`)に持つ。
- **AI の下書きの生成**: 1回の生成で、構成図(LLM 1回)→ その構成図のパッケージをファイルに分けたモジュール一覧(LLM 1回)を作る。1つのトランザクションで書く。
- **段階4の差し戻し**: 構成図を直したら、承認済みの段階4を「レビュー中」に戻す。

実務との対応: 構成図は arc42 の Level 1(ビルディングブロックの全体図)、モジュール一覧は Level 2(ファイル単位の責務表)に当たる。日本の詳細設計では「方式設計」の構成図とモジュール一覧である([`appendix/detailed-design-mode-organization.md`](../../appendix/detailed-design-mode-organization.md) 2章)。

[Phase 14-4](../Phase-14/Phase-14-4.md) の Phase 19 の行(BE「構成図(層)とモジュール一覧(パス/層/責務/主な依存先/関わる処理)の生成」、FE「モジュール一覧のレビュー」、再利用「component の意味モデル・生成・レイアウト(Phase 8〜12)」)に沿う。表に無いものとして、構成図の編集による段階4の差し戻し(19-4)と、ER の埋め込みの共通化(19-7)を足した。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 19 開始時」を参照。

1. **構成図は component 図1枚**(`uml_diagrams`、notation=component、subject='')。箱はパッケージ単位で、層をレーンにする。段階4の承認には構成図の承認が要る(段階3の ER と同じ形)。モジュール一覧から自動で描く案は採らなかった(ファイル単位の箱になり20個を超えやすく、パッケージ単位の俯瞰図にならないため)。
2. **「関わる処理」「主な依存先」は AI が下書きし、コードで検証する**。CRUD 図から決定的に作る案は採らなかった(テーブルとモジュールの対応は名前の推測になり、外れると固定部分が壊れるため)。CRUD 図と ER は AI への入力として渡す。
3. **段階4をまるごと1 Phase**(BE 4章+FE 3章)。Phase の番号は送らない。

Claude の判断で決めたこと(計画の承認で確定):

- 段階4の `model` は `{modules: [{path, layer, responsibility, depends_on, functions, all_functions}]}` だけ。構成図は model に複製しない(19-1)。
- `all_functions` は、アプリの組み立て・認証の DI・例外の変換のように全処理が通る横断のモジュールの印(出力見本の「全処理」)。処理のカバー(全処理がどこかの行に出るか)の判定には数えない(19-1)。
- 再生成は置き換える(段階3と同じ)。構成図は `_save_diagram` で同じ行を上書きし、承認はやり直しになる(19-3)。
- 構成図の出力スキーマと写像は、ステージ3の `ComponentGenerationOutput`・`to_component` を再利用する。プロンプトだけ段階4専用にする(19-2)。
- FE の図の埋め込みは、`ErEditorSection` を `StageDiagramSection`(記法・対象・名前を引数にする)に共通化する(#17。消費者は段階4の構成図)。`ErEditorSection` は薄い包みとして残し、`DataModelPanel` は変えない(19-7)。

## パイプライン上の位置づけ・前提

```
段階4:  POST /design-stages/4/generate ─ 受け付け(生成中に)→ BackgroundTasks                      (19-3)
          execute: 段階1〜3(承認済み)+ 要件定義書 + ER の要約(StageSources)
                   → AI(構成図。ステージ3のスキーマ)→ to_component
                     → uml_diagrams(notation=component、subject='')を上書き                       (19-2, 19-3)
                   → AI(モジュール一覧。構成図・CRUD 図・ER を渡す)→ merge_modules             (19-1, 19-2)
                   → 1回だけ commit                                                              (19-3)
        GET /design-stages ─ issues(構成図の状態・パスの重複・処理のカバー・層・依存先)         (19-1, 19-3)
        PUT /design-stages/4(モジュール一覧の保存)
        構成図の保存・自動レイアウト(SCR-007 の API)→ 承認済みの段階4を差し戻す              (19-4)
        POST /design-stages/4/approve(エラーが無いこと = 構成図が承認済み)
[FE]:   SCR-008 段階4 = StructurePanel(生成・確認・保存)                                       (19-7)
                      + StageDiagramSection(UmlDiagramEditor で構成図)                         (19-7)
                      + ModuleListTable(moduleListOps。層は構成図から選ぶ)                       (19-6)
```

- **前提として読むもの**:
  - [`Phase-18-introduction.md`](../Phase-18/Phase-18-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する1点(モジュール一覧の入力に、段階3の CRUD 図と ER を使う)。
  - [`Phase-18-1.md`](../Phase-18/Phase-18-1.md)・[`Phase-18-3.md`](../Phase-18/Phase-18-3.md)・[`Phase-18-4.md`](../Phase-18/Phase-18-4.md)・[`Phase-18-9.md`](../Phase-18/Phase-18-9.md): 段階の外に正本を持つ図の扱い(要約で検証に渡す・2回の LLM を1トランザクションで書く・図の編集で段階を差し戻す・図の埋め込み)。段階4は同じ形を構成図で繰り返す。
  - [`appendix/detailed-design-devex/content.py`](../../appendix/detailed-design-devex/content.py) の `COMPONENTS`・`COMPONENT_DEPS`・`MODULES`: 段階4の見本(パッケージ単位の構成図と、ファイル単位のモジュール一覧。「全処理」の行)。
- **本 Phase 開始時点の状態**:
  - 段階4の作業領域は「準備中」の表示だけだった。生成の対応表と検証の対応表には段階1〜3しか無かった。
  - component 図はステージ3(簡易ドキュメントモード)で使っていたが、詳細設計モードには無かった。`ComponentElement.layer` は自動レイアウトのレーンになる(Phase 9)。

## モード宣言(#21)

- **19-5 を納期モード**にする。条件(a): 型と定数・テスト用の雛形の追加で、定型が過半。条件(b): コアループ(チャット → 4文書生成)ではない付随作業。
- **残りの章は学習モード**。
  - 19-1〜19-4 は、図を段階の model に複製しない・パスを後の段階の鍵として守る・ステージ3の生成を段階4に再利用する・図の編集で段階を差し戻す、という設計判断そのものだから。
  - 19-6・19-7 は、区切りの入力欄の持ち方・構成図に無い層の見せ方・図の埋め込みの共通化(#17)という画面側の判断を含むため。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-19-1.md`](./Phase-19-1.md) | BE: 段階4の意味モデル、モジュール一覧の組み立て、構成図の層、段階4の検証(すべて純粋) | 学習 | なし |
| [`Phase-19-2.md`](./Phase-19-2.md) | BE: 段階4の下書きのプロンプト(構成図・モジュール一覧)と出力スキーマ(純粋) | 学習 | 19-1 |
| [`Phase-19-3.md`](./Phase-19-3.md) | BE: 段階4の生成(2回の LLM・1トランザクション・`_save_diagram`)、段階の入力に構成図の要約 | 学習 | 19-2 |
| [`Phase-19-4.md`](./Phase-19-4.md) | BE: 構成図の編集による段階4の差し戻し | 学習 | 19-3 |
| [`Phase-19-5.md`](./Phase-19-5.md) | FE: 型(段階4の意味モデル・`STRUCTURE_SUBJECT`)、構成図の未承認を承認時に出す | 納期 | 19-4 |
| [`Phase-19-6.md`](./Phase-19-6.md) | FE: モジュール一覧の編集操作(純粋)とモジュール一覧の表 | 学習 | 19-5 |
| [`Phase-19-7.md`](./Phase-19-7.md) | FE: 図の埋め込みの共通化、段階4の作業領域(生成・構成図・保存)と、段階 → パネルの登録 | 学習 | 19-6 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{structure,structure_drafting,prompt_rules}.py`(`prompt_rules.py` は画面確認後)
  - 新規(テスト): `tests/unit/test_{structure,structure_drafting}.py`
  - 更新: `app/detailed_design/{__init__,validation}.py`、`app/detailed_design/{drafting,data_flow_drafting,data_model_drafting}.py`(画面確認後)、`app/ai/llm/fake.py`、`app/services/{design_stage_service,design_stage_generation_service,uml_diagram_service}.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{function_list,design_stage_generation,design_stage_reopen}.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/detailed-design/`):
  - 新規: `moduleListOps.ts`、`components/{ModuleListTable,StageDiagramSection,StructurePanel}.tsx`
  - 新規(テスト): `__tests__/moduleListOps.test.ts`、`components/__tests__/{ModuleListTable,StageDiagramSection,StructurePanel}.test.tsx`
  - 更新: `api/types.ts`、`labels.ts`、`test-utils/stageFixtures.ts`、`components/{ErEditorSection,StageWorkArea}.tsx`
  - 更新(テスト): `__tests__/labels.test.ts`、`components/__tests__/StageWorkArea.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 19-1 | `detailed_design/structure.py`(新規)、`validation.py`・`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | 段階4の正本の形を決め、AI の下書きからモジュール一覧を整え、構成図の要約で段階4を検証する | `uv run pytest tests/unit/test_structure.py tests/unit/test_function_list.py` |
| 19-2 | `detailed_design/structure_drafting.py`(新規)、`fake.py`(更新) | 構成図とモジュール一覧を AI に書かせる入力を組み立て、出力を変換する | `uv run pytest tests/unit/test_structure_drafting.py` |
| 19-3 | `design_stage_generation_service.py`・`design_stage_service.py`・`tests/fixtures/detailed_design.py`(更新) | 段階4の生成を受け付けて裏で実行し、構成図とモジュール一覧を1回で書く。検証に構成図の要約を渡す | `uv run pytest tests/unit/test_design_stage_generation.py tests/unit/test_design_stage_service.py` |
| 19-4 | `uml_diagram_service.py`(更新) | 構成図の人の編集で、承認済みの段階4を差し戻す | `uv run pytest tests/unit/test_design_stage_reopen.py tests/unit/test_uml_diagram_service.py` |
| 19-5 | `api/types.ts`・`labels.ts`・`stageFixtures.ts`(更新) | 段階4の型と、構成図の未承認を承認時に出す登録 | `npx vitest run src/features/detailed-design/__tests__/labels.test.ts`、`npx tsc --noEmit` |
| 19-6 | `moduleListOps.ts`・`components/ModuleListTable.tsx`(新規) | モジュール一覧の行を足す・直す・消す表。層は構成図から選ぶ | `npx vitest run src/features/detailed-design/__tests__/moduleListOps.test.ts src/features/detailed-design/components/__tests__/ModuleListTable.test.tsx` |
| 19-7 | `components/{StageDiagramSection,StructurePanel}.tsx`(新規)、`ErEditorSection.tsx`・`StageWorkArea.tsx`(更新) | 図の埋め込みを共通化し、段階4の作業領域を組み立てて登録する | `npx vitest run src/features/detailed-design/components` |

## 写経順序(#23)

章番号順(19-1 → 19-2 → … → 19-7)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、2つの章で少しずつ完成する。各章の担当分には `# Phase-19-<n>:追記` / `# Phase-19-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `tests/fixtures/detailed_design.py`(19-1 → 19-3)

FE は、1つのファイルを複数の章で書き足さないように章の順を組んだ(Phase 18 と同じく「部品 → 作業領域」)。

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 567件が成功(Phase 18 完了時は 546件)。画面確認後の修正の後は 580件。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 532件(101ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **マイグレーション**: 不要(段階4の model は JSONB、構成図は既存の `uml_diagrams`)。
- **samples と本体の一致**: タグと旧コードのコメントを取り除いた samples を、本体と比べた。本 Phase で触ったファイルの差は、以前からあったコメントの違いだけである(`fake.py`・`uml_diagram_service.py`・`StageWorkArea.tsx` の複数行の JSX コメントのタグ)。バックエンドの samples は Python 3.13 で構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。`structure_drafting.py`(19-2)は `structure.ModuleDraft`(19-1)、生成サービス(19-3)は `structure`・`structure_drafting`(19-1・19-2)、`uml_diagram_service.py`(19-4)は `STRUCTURE_STAGE`(19-1)、`StructurePanel.tsx`(19-7)は `ModuleListTable`(19-6)・`StageDiagramSection`(19-7 の先頭)を import する。各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた(19-5 の `api/types.ts` は `stageFixtures.ts` の型の import と `tsc` で確かめる)。
- **章タグの境界(#12)**: 既存の関数の前に Phase 19 のブロックを足した箇所には、後ろの既存コードに章タグが引き継がれないよう「ここから Phase-X-Y の作成分」の再タグを置いた。

- **画面での確認**: ユーザーが画面で確かめ、2点を直した。依存先にディレクトリを書くと警告が出る(照合を区切り単位の部分一致に。[19-1](./Phase-19-1.md)「画面確認後の修正」)、責務が英語になる(段階1〜4の下書きに共通の表記の規則 `NAMING_RULES`。[19-2](./Phase-19-2.md)「画面確認後の修正」)。

## 後続 Phase への申し送り

- **段階5以降の下書きのプロンプト**: `app/detailed_design/prompt_rules.py` の `NAMING_RULES` を末尾に足す(表記の規則は詳細設計モードの全段階で共通。ユーザーの決定)。手順の「呼び出し先」とモジュール一覧のパスの照合には `module_ref_matches`(区切り単位の部分一致)を使える。

- **段階5(Phase 20)**: 手順の「呼び出し先」は、モジュール一覧のパス(`design_stages.model`(段階4)の `modules[].path`)で書く。関与表の列もこのパスだけにする(利用者・スケジューラ等の外部の役者は含めない。[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節)。パスの重複は段階4の検証のエラーなので、承認済みの段階4ではパスが一意である。
- **段階6を飛ばす操作**: [Phase 15](../Phase-15/Phase-15-introduction.md) の申し送りは「Phase 19 で決める」だったが、番号を送る前の記述で、段階6は Phase 20(段階5・6)の範囲である。Phase 20 で決める。
- **組み立て(Phase 21)**: 04章の構成図は `uml_diagrams`(notation=component、subject='')の SVG、モジュール一覧は段階4の `modules`(`all_functions` は「全処理」、`functions` は処理IDの並び。出力見本のように「F-01〜F-04」とまとめるかは Phase 21 で決める)。
- **構成図の層とモジュール一覧の層**: 名前で突き合わせる(一致しなければ警告 `UNKNOWN_LAYER`)。構成図で層を改名したときの、モジュール一覧の追従はしていない(人が選び直す)。
- **既存のプロジェクト**: 段階4は新しく使えるようになっただけで、既存のデータの移行は無い。
- **開発環境への反映**: 開発用 DB には、Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用のまま(本 Phase はマイグレーションなし)。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 構成図を段階4の `model` に複製せず、モジュール一覧だけを持たせたのはなぜか。構成図の層とモジュール一覧の層は、どこで突き合わせているか。
2. モジュールのパスの重複を「警告」でなく「エラー」にしたのはなぜか(段階5の何の鍵になるかから説明する)。
3. `all_functions`(全処理)の行を、処理のカバーの判定に数えないのはなぜか。数えると、どんな見落としが起きるか。
4. 構成図の生成で、ステージ3の出力スキーマと写像を再利用し、プロンプトだけを段階4用にしたのはなぜか。簡易ドキュメントモードの component 図に影響しないのはなぜか。
5. `ErEditorSection` を `StageDiagramSection` に共通化した判断を、#17 の「この共通化を今駆動している、この Phase の実在の消費者は何か」に答える形で説明できるか。
