# Phase 20 導入: 段階5 主要処理の手順(ステージ4)

## 目的

詳細設計モードの段階5「主要処理の手順」を、処理の選択 → 下書き → 編集 → 承認まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の5行目に当たる。入力は、承認済みの段階2(データフロー)と段階4(ソフトウェア構造)である。下書きには、段階1(機能一覧)と段階3(CRUD 図・ER のテーブル)も参考に渡す。

- **手順を書く処理の選択**: 「重要な部分だけ書く」実務の原則に従い、人が選んだ処理だけに手順を書く。
- **番号付きの手順の表**: 列は `No / 呼び出し元 → 呼び出し先 / 渡すデータ / 処理内容 / 結果 / DB 操作 / 分岐・例外`(Phase 14 で確定)。分岐はサブ番号(`4a`)で、元の手順の直後に置く。
- **AI の下書きの生成**: 処理ごとに LLM を1回呼ぶ。手順の無い処理はまとめて生成でき、手順のある処理はタブごとに1処理だけ作り直せる。
- **索引と関与表**: 章の冒頭に、索引(処理ID/名称/トリガー/選定理由/手順数)と「処理 × モジュール」の関与表(セルは手順番号)を置く。処理ごとの手順はタブで切り替える。

実務との対応: 日本の詳細設計の「処理フロー(処理シーケンス)」に当たる。シーケンス図の代わりに、番号付きの手順の表で書く(D7。シーケンス図へ進むかはステージ4の運用の後に判断する)。

[Phase 14-4](../Phase-14/Phase-14-4.md) の Phase 20 の行は「段階5・6」だった。着手時の決定2で段階5だけにし、段階6を Phase 21 に送った。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 20 開始時」を参照。

1. **Phase 19 を先にコミットする**(外側 0775cb6・devex-api 2cef26b・devex-ui 73e8273)。
2. **Phase 20 は段階5だけ**にする。番号を1つ送り、Phase 21 = 段階6 処理ロジックの詳細(段階6を飛ばす操作を含む)、Phase 22 = 詳細設計書の組み立て・出力・実装計画・E2E とする。段階5・6をまとめると12〜14章になり、1段階 = 1 Phase(Phase 16〜19)の粒度から外れるため。
3. **05↔06 の紐づけは「(呼び出し先, 関数)から導く」**。手順の行は呼び出し先のパス(`callee`)と呼ぶ関数(`call`)だけを持ち、06 の L-ID(`logic`)は持たない。段階6の項目は (モジュール, 関数) を持ち、「呼ばれる手順」・詳細バッジ・逆引きは、両者の一致から導く。Phase 14 の決定(「正本は手順の行の `logic`」)のままだと、段階6で関数を選ぶたびに承認済みの段階5を書き換えることになる。すると段階5が差し戻され、段階6が「古い」になる循環が起きる。docs 3.3 は撤回の blockquote で書き換えた。
4. **段階5の生成は処理ごと**にする。対象の処理を選んで保存し、手順の無い処理をまとめて生成する。作り直しはタブごとに1処理だけ行う(他の処理の手直しは残る)。手順の表は人の手直しが多くなる見込みのため、段階2〜4の「作り直しは全部置き換え」にしなかった。

Claude の判断で決めたこと(計画の承認で確定):

- 段階5の `model` は `{procedures: [{function_id, reason, note, steps: [{caller, callee, call, data, action, result, db, branch, is_branch}]}]}`(20-1)。計画では列名を `from_`/`to` としていたが、`from` が Python の予約語で別名の扱いが要るため、`caller`/`callee` にした。
- **手順番号は保存しない**。並び順と `is_branch` から `number_steps` で導く(20-1)。行を足したり消したりしても、番号の付け直しを人や AI に任せずに済む。05↔06 を番号でなく (呼び出し先, 関数) でつなぐので、番号が振り直されても紐づけは切れない。
- **呼び出し先はモジュール一覧のパスにそろえる**(`resolve_callee`。Phase 19 の `module_ref_matches` を再利用)。そろわないパスは検証のエラーにする(関与表の列の鍵のため)。外部の役者(利用者・スケジューラ)は「/」を含まない名前で書く(20-1)。
- 生成の対象は、受け付けで決めて background task に値で渡す(20-3)。生成中は保存できないので、実行時に同じ規則で導き直しても同じ対象になる。1回の上限は5処理(段階2の DFD のグループと同じ値)。
- FE の索引と関与表は、段階5の model と段階4のモジュール一覧(段階の一覧に含まれる)から画面で導く(20-5)。段階3の `dfd_accesses` のようにバックエンドで導かないのは、編集中の内容にすぐ反映させるため。
- デモページ(`demo/procedureModel.ts`)は形式の見本のまま触らない。HTML・md への出力は Phase 22 でバックエンドへ移す。

## パイプライン上の位置づけ・前提

```
段階5:  PUT /design-stages/5(手順を書く処理の選択・手順の編集を保存)                            (20-7)
        POST /design-stages/5/generate {function_ids?}                                             (20-3)
          受け付け: 対象 = 指定の処理 or 選んだ処理のうち手順の無いもの(空・未選択・6件以上は 409)
          execute: 段階1〜4(承認済み)+ ER の要約 + DFD の R/W(StageSources)
                   → 対象の処理ごとに AI(手順)→ merge_procedure(呼び出し先をパスにそろえる)    (20-1, 20-2)
                   → 1回だけ commit(途中で失敗したら全部取り消す)                                (20-3)
        GET /design-stages ─ issues(処理ID・手順の有無・先頭の分岐・呼び出し先のパス)          (20-1)
        POST /design-stages/5/approve(エラーが無いこと)
[FE]:   SCR-008 段階5 = ProcedurePanel(選択・生成・索引・関与表・タブ・保存)                   (20-7)
                      + ProcedureStepTable(1処理の手順の表)                                     (20-6)
                      + procedureOps(番号・行の操作・索引・関与表。純粋)                         (20-5)
```

- **前提として読むもの**:
  - [`Phase-19-introduction.md`](../Phase-19/Phase-19-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する3点(手順の呼び出し先はモジュール一覧のパス、`NAMING_RULES` を段階5のプロンプトにも足す、`module_ref_matches` の再利用)。
  - [`Phase-19-1.md`](../Phase-19/Phase-19-1.md)「画面確認後の修正」: 区切り単位の部分一致(`module_ref_matches`)。呼び出し先の正規化に使う。
  - [`Phase-17-introduction.md`](../Phase-17/Phase-17-introduction.md): 段階2の「グループを選んで保存 → 生成」。段階5の「処理を選んで保存 → 生成」は同じ形である。
  - デモページ `devex-ui/src/features/detailed-design/demo/`(Phase 14): 05 章の見せ方(索引・関与表・タブ)の見本。
- **本 Phase 開始時点の状態**:
  - 段階5の作業領域は「準備中」の表示だけだった。生成の対応表と検証の対応表には段階1〜4しか無かった。
  - 生成の受け付け(`POST /generate`)は本文を持たず、段階の全体を作り直すだけだった。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、20-4 を納期モード、他を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-20-1.md`](./Phase-20-1.md) | BE: 段階5の意味モデル、手順番号、呼び出し先の正規化、1処理の置き換え、段階5の検証(すべて純粋) | 学習 | なし |
| [`Phase-20-2.md`](./Phase-20-2.md) | BE: 段階5の下書きのプロンプトと出力スキーマ(純粋) | 学習 | 20-1 |
| [`Phase-20-3.md`](./Phase-20-3.md) | BE: 生成の対象の受け渡し(リクエストの本文・受け付けの確認・処理ごとの生成・1トランザクション) | 学習 | 20-2 |
| [`Phase-20-4.md`](./Phase-20-4.md) | FE: 型・生成の本文・ストア・テスト用の雛形 | 納期 | 20-3 |
| [`Phase-20-5.md`](./Phase-20-5.md) | FE: 手順の編集操作と、索引・関与表の導き方(純粋) | 学習 | 20-4 |
| [`Phase-20-6.md`](./Phase-20-6.md) | FE: 1処理の手順の表 | 学習 | 20-5 |
| [`Phase-20-7.md`](./Phase-20-7.md) | FE: 段階5の作業領域(選択・生成・索引・関与表・タブ)と、段階 → パネルの登録 | 学習 | 20-6 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{procedure,procedure_drafting}.py`
  - 新規(テスト): `tests/unit/test_{procedure,procedure_drafting}.py`
  - 更新: `app/detailed_design/{__init__,validation}.py`、`app/ai/llm/fake.py`、`app/schemas/design_stage.py`、`app/api/routes/design_stages.py`、`app/services/design_stage_generation_service.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{function_list,design_stage_generation}.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/detailed-design/`):
  - 新規: `procedureOps.ts`、`components/{ProcedureStepTable,ProcedurePanel}.tsx`
  - 新規(テスト): `__tests__/procedureOps.test.ts`、`components/__tests__/{ProcedureStepTable,ProcedurePanel}.test.tsx`
  - 更新: `api/{types,designStagesApi}.ts`、`detailed-design-store.ts`、`test-utils/stageFixtures.ts`、`components/StageWorkArea.tsx`
  - 更新(テスト): `api/__tests__/designStagesApi.test.ts`、`__tests__/detailed-design-store.test.ts`、`components/__tests__/StageWorkArea.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 20-1 | `detailed_design/procedure.py`(新規)、`validation.py`・`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | 段階5の正本の形を決め、AI の下書きを1処理ずつ取り込み、モジュール一覧のパスで段階5を検証する | `uv run pytest tests/unit/test_procedure.py tests/unit/test_function_list.py` |
| 20-2 | `detailed_design/procedure_drafting.py`(新規)、`fake.py`(更新) | 1つの処理の手順を AI に書かせる入力を組み立て、出力を変換する | `uv run pytest tests/unit/test_procedure_drafting.py` |
| 20-3 | `schemas/design_stage.py`・`api/routes/design_stages.py`・`design_stage_generation_service.py`・`procedure.py`・`tests/fixtures/detailed_design.py`(更新) | 生成の対象をリクエストから実行まで渡し、対象の処理だけを置き換える | `uv run pytest tests/unit/test_design_stage_generation.py` |
| 20-4 | `api/types.ts`・`api/designStagesApi.ts`・`detailed-design-store.ts`・`stageFixtures.ts`(更新) | 段階5の型と、生成に対象の処理を渡す口 | `npx vitest run src/features/detailed-design/api src/features/detailed-design/__tests__/detailed-design-store.test.ts`、`npx tsc --noEmit` |
| 20-5 | `procedureOps.ts`(新規) | 手順の行の操作と、番号・索引・関与表を導く | `npx vitest run src/features/detailed-design/__tests__/procedureOps.test.ts` |
| 20-6 | `components/ProcedureStepTable.tsx`(新規) | 1処理の手順の表を編集する(分岐の行・一覧に無い呼び出し先の印) | `npx vitest run src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx` |
| 20-7 | `components/ProcedurePanel.tsx`(新規)、`StageWorkArea.tsx`(更新) | 段階5の作業領域を組み立てて登録する | `npx vitest run src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx` |

## 写経順序(#23)

章番号順(20-1 → 20-2 → … → 20-7)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、2つの章で少しずつ完成する。各章の担当分には `# Phase-20-<n>:追記` / `# Phase-20-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/detailed_design/procedure.py`(20-1 → 20-3。`generation_targets` は 20-3)
- `app/detailed_design/__init__.py`(20-1 → 20-3)
- `tests/fixtures/detailed_design.py`(20-1 → 20-3。`create_stage5_project` は 20-3)

FE は、1つのファイルを複数の章で書き足さないように章の順を組んだ(Phase 18・19 と同じく「部品 → 作業領域」)。

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 618件が成功(Phase 19 完了時は 580件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 556件(104ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **マイグレーション**: 不要(段階5の model は JSONB)。
- **samples と本体の一致**: タグと旧コードのコメントを取り除いた samples を、本体と比べた。本 Phase で触った部分に差は無い。残る差は、以前からあった書き方の違いだけである(`fake.py` のコメント・`test_design_stage_generation.py` の段階1のテストの改行・`StageWorkArea.tsx` の複数行の JSX コメントのタグ)。バックエンドの samples は Python 3.13 で構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。
  - `procedure.py`(20-1)は `structure.module_ref_matches`(Phase 19)、`validation.py`(20-1)は `procedure`(20-1)を import する。`procedure_drafting.py`(20-2)は `procedure.ProcedureDraft`・`ProcedureStep`(20-1)と `structure.ModuleRow`(Phase 19)を import する。
  - 生成サービス(20-3)は `procedure.generation_targets`(20-3 の先頭で追記)と `procedure_drafting`(20-2)を import する。`create_stage5_project`(20-3)は既存の `create_stage4_project` だけを使う。
  - `ProcedureStepTable.tsx`(20-6)は `procedureOps`(20-5)、`ProcedurePanel.tsx`(20-7)は `ProcedureStepTable`(20-6)と `MAX_PROCEDURE_TARGETS`(20-4)を import する。
  - 各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた(20-4 の `api/types.ts` は `stageFixtures.ts` の型の import と `tsc` で確かめる)。
- **章タグの境界(#12)**: 既存の関数の前に Phase 20 のブロックを足した箇所と、更新の後ろに既存のコードが続く箇所には、後ろの既存コードに章タグが引き継がれないよう「ここから Phase-X-Y の作成分」の再タグを置いた(`validation.py`・生成サービス・`StageWorkArea.test.tsx` など)。
- **画面での確認**: ユーザーに依頼中(未実施)。

## 後続 Phase への申し送り

- **段階6(Phase 21)**:
  - 段階6の項目は (モジュール, 関数) を持つ。「呼ばれる手順」は、承認済みの段階5の手順のうち `callee` と `call` が一致する行から導く(着手時の決定3)。段階5の `model` は書き換えない。
  - 関数を選ぶ候補は、段階5の手順のうち、呼び出し先がモジュール(パス)で `call` が空でない行(空の行は段階5の検証の警告 `EMPTY_CALL`)。同じ (モジュール, 関数) を呼ぶ手順は1つの項目にまとまる。
  - 段階6を飛ばす操作をここで決める。
- **組み立て(Phase 22)**: 05 章は段階5の `procedures`。手順番号は `number_steps`、手順IDは `step_id` で導く。索引の「紐づく06の項目」と詳細バッジは、段階6の項目との (呼び出し先, 関数) の一致から導く。デモの `toHtml`・`toMarkdown` をバックエンドへ移すときは、`logic` の代わりにこの一致を使う。
- **DB 操作の列**: 自由記述のまま。CRUD 図との食い違いは検証していない(AI には CRUD 図の行を渡して合わせさせている)。必要なら後で警告にする。
- **処理の改名・削除**: 段階1で処理が消えると、段階5の行は検証のエラー(`UNKNOWN_FUNCTION`)になる。生成では飛ばす(LLM を呼ばない)。
- **既存のプロジェクト**: 段階5は新しく使えるようになっただけで、既存のデータの移行は無い。
- **開発環境への反映**: 開発用 DB には、Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用のまま(本 Phase はマイグレーションなし)。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 手順番号を `model` に保存せず、並び順から導くことにしたのはなぜか。05↔06 を番号でなく (呼び出し先, 関数) でつなぐことと、どう関係するか。
2. Phase 14 の「05↔06 の正本は手順の行の `logic`」を撤回したのはなぜか。段階6で関数を選ぶたびに何が起きるかから説明する。
3. 呼び出し先がモジュール一覧のパスと完全一致しないとき、警告でなくエラーにしたのはなぜか。`resolve_callee` は、どこまでを自動でそろえ、どこから人に任せているか。
4. 段階5の生成を「処理ごとに置き換える」形にしたのはなぜか。段階2〜4の「全部置き換える」と比べて、受け付け・実行・状態(`regenerated`)の判定で何が変わったか。
5. 生成の対象を受け付けで決めて background task に値で渡しつつ、実行時にも同じ規則で導き直しているのはなぜ安全か(生成中に何が禁止されているか)。
