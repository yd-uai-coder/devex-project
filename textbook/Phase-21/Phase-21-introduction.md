# Phase 21 導入: 段階6 処理ロジックの詳細(ステージ4)

## 目的

詳細設計モードの段階6「処理ロジックの詳細」(06 章、任意)を、関数の選択 → 下書き → 編集 → 承認(または飛ばす)まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の6行目に当たる。入力は承認済みの段階5(主要処理の手順)で、下書きには段階1(機能一覧)・段階4(モジュール一覧)・段階3(ER のテーブル名)も参考に渡す。

- **詳細を書く関数の選択**: 「重要な部分だけ書く」実務の原則に従い、段階5の手順が呼ぶ関数のうち、人が選んだものだけに詳細を書く。
- **1関数の詳細**: シグネチャ/引数/戻り値/例外/事前条件/事後条件の表と、番号付きの擬似フロー(Phase 14 で確定)。
- **AI の下書きの生成**: 関数ごとに LLM を1回呼ぶ。下書きの無い関数はまとめて生成でき、詳細のある関数はタブごとに1関数だけ作り直せる(段階5と同じ形)。
- **05↔06 の紐づけ**: 06 の各項目に「呼ばれる手順」(`F-01#4`)、05 の手順に「詳細 L-02」のバッジを出し、押すと相手の段階のタブ・行へ移る。章の冒頭に逆引き(L-ID/関数/モジュール/呼ばれる手順)を置く。
- **段階6を飛ばす**: 06 を書かないときは、0件で承認する。

実務との対応: 日本の詳細設計の「モジュール仕様(関数仕様)」と「処理ロジック(擬似コード・フローチャート)」に当たる。フローチャートの代わりに番号付きの擬似フローで書く。

[Phase 20](../Phase-20/Phase-20-introduction.md) の着手時に段階5と段階6を分け、段階6を本 Phase に送った。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 21 開始時」を参照。

1. **段階6を飛ばす = 0件で承認**。段階6の作業領域に「段階6を飛ばす(06を書かない)」ボタンを置き、確認ダイアログの後に `{logics: []}` を保存して承認する(既存の保存・承認の API を順に呼ぶ)。検証は0件をエラーにしない。段階5が変わって「古い」になれば「このまま承認し直す」で済む。06 章は Phase 22 の組み立てで「省略」と出す。段階7の入力に段階6の承認が要る(`STAGE_INPUTS[7]`)ので、飛ばした状態も承認済みにする必要があった。専用の skip API や、段階7の入力から段階6を外す案は採らなかった(前者は API と型が増える、後者は陳腐化の伝わる道筋が切れる)。
2. **05↔06 のバッジは段階をまたいで移動する**。段階5の手順の表に「詳細 L-02」、段階6の各項目に「呼ばれる手順 F-01#4」のバッジを置き、押すと相手の段階・タブ・行へ切り替えて強調する。保存していない編集があるときは移動の前に確認する。推奨は「段階6の中だけ双方向、段階5は表示だけ」だったが、ユーザーが段階またぎを選んだ。そのため章を1つ足した(21-8)。

Claude の判断で決めたこと(計画の承認で確定):

- 段階6の `model` は `{logics: [{module, function, signature, args, returns, raises, pre, post, pseudo: [{text, sub}]}]}`(21-1)。擬似フローはデモの `LogicSpec.pseudo` と同じ2階層。
- **L-ID は保存しない**。並び順から `logic_id` で導く(段階5の手順番号と同じ考え方。21-1)。05↔06 は (モジュール, 関数) でつなぐので、L-ID が振り直されても紐づけは切れない。
- 候補は段階5の手順のうち、分岐でなく、呼び出し先がパスで、関数が空でない行。同じ (callee, call) は1つにまとめる(21-1)。
- 検証のエラーに「段階5のどの手順からも呼ばれない」(`UNCALLED_LOGIC`)を入れた。06 の項目には必ず「呼ばれる手順」があるようにするため(21-1)。
- 生成の対象は、本文 `logics: [{module, function}]` で受け、内部では `logic_key`(`module::function`)の文字列で `StageGenerationContext.targets` に入れる(21-3)。上限は5(段階5と同じ)。
- 生成の入力に要件定義(技術スタック)は渡さず、シグネチャの言語はモジュールのパスから判断させる(21-2)。段階6の入力を段階5だけに保ち、要件定義の変更で段階6が「古い」にならないようにするため。
- 段階またぎの移動先はストアの `focus` に置き、移動先のパネルが作られたときに一度だけ読んで消す(21-4・21-8)。
- 飛ばすボタンから承認の完了ダイアログを出すため、`StagePanelProps` に任意の `onApprove` を足した(21-7)。
- デモページ(`demo/`)は形式の見本のまま触らない。HTML・md への出力は Phase 22 でバックエンドへ移す。

## パイプライン上の位置づけ・前提

```
段階6:  PUT /design-stages/6(詳細を書く関数の選択・詳細の編集を保存。0件 = 飛ばす)                     (21-7)
        POST /design-stages/6/generate {logics?: [{module, function}]}                                   (21-3)
          受け付け: 対象 = 指定の関数 or 選んだ関数のうち下書きの無いもの(空・未選択・6件以上は 409)
          execute: 段階1・4・5(承認済み)+ ER のテーブル名(StageSources)
                   → 対象の関数ごとに AI(呼ばれる手順と分岐を渡す)→ merge_logic                   (21-1, 21-2)
                   → 1回だけ commit                                                                    (21-3)
        GET /design-stages ─ issues(重複・呼ばれない関数・下書きなし・条件が空。target は L-ID)       (21-1)
        POST /design-stages/6/approve(エラーが無いこと。0件も通る)
[FE]:   SCR-008 段階6 = LogicPanel(選択・生成・逆引き・タブ・保存・飛ばす)                            (21-7)
                      + LogicSpecEditor(1関数の詳細)                                                   (21-6)
                      + logicOps(候補・呼ばれる手順・逆引き・L-ID。純粋)                               (21-5)
        段階5 ⇄ 段階6: 詳細バッジ / 呼ばれる手順バッジ → store.jumpTo → 移動先のパネルが focus を読む  (21-4, 21-8)
```

- **前提として読むもの**:
  - [`Phase-20-introduction.md`](../Phase-20/Phase-20-introduction.md)「後続 Phase への申し送り」: 本 Phase が回収する3点(段階6の項目は (モジュール, 関数)、候補は `call` が空でない手順、飛ばす操作を決める)。
  - [`Phase-20-1.md`](../Phase-20/Phase-20-1.md): 手順番号を保存しない理由と `number_steps`・`step_id`。段階6でも再利用する。
  - [`Phase-20-7.md`](../Phase-20/Phase-20-7.md): 段階5の作業領域の形(2通りの生成・作り直しの確認)。段階6も同じ形にした。
  - デモページ `devex-ui/src/features/detailed-design/demo/`(Phase 14): 06 章の見せ方(逆引き・関数ごとのタブ・バッジ)の見本。
- **本 Phase 開始時点の状態**:
  - 段階6の作業領域は「準備中」の表示だけだった。生成と検証の対応表には段階1〜5しか無かった。
  - 段階6を飛ばす手段が無く、段階7を開くには段階6に何かを書いて承認する必要があった。

## モード宣言(#21)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も並行して作った)。

> 旧ルール(学習モード / 納期モード)では、21-4 を納期モード、他を学習モードとした。旧・納期モードの章は、#14 の SUT/ドライバ/スタブの言語化を省いている。旧ルールから自動実装モードへ改めた経緯は [`overall-retrospective.md`](../appendix/overall-retrospective.md) を参照。

## 章一覧

| 章 | トピック | 旧モード | 依存 |
|---|---|---|---|
| [`Phase-21-1.md`](./Phase-21-1.md) | BE: 段階6の意味モデル、05↔06 の紐づけ(候補・呼ばれる手順)、1関数の置き換え、段階6の検証(すべて純粋) | 学習 | なし |
| [`Phase-21-2.md`](./Phase-21-2.md) | BE: 段階6の下書きのプロンプトと出力スキーマ(純粋) | 学習 | 21-1 |
| [`Phase-21-3.md`](./Phase-21-3.md) | BE: 生成の対象の受け渡し(リクエストの本文・受け付けの確認・関数ごとの生成)と飛ばす操作の確認 | 学習 | 21-2 |
| [`Phase-21-4.md`](./Phase-21-4.md) | FE: 型・生成の本文・ストア(移動先 `focus`)・テスト用の雛形 | 納期 | 21-3 |
| [`Phase-21-5.md`](./Phase-21-5.md) | FE: 段階6の編集操作と、05↔06 の紐づけの導き方(純粋) | 学習 | 21-4 |
| [`Phase-21-6.md`](./Phase-21-6.md) | FE: 1関数の詳細の編集 | 学習 | 21-5 |
| [`Phase-21-7.md`](./Phase-21-7.md) | FE: 段階6の作業領域(選択・生成・逆引き・タブ・飛ばす)と、段階 → パネルの登録 | 学習 | 21-6 |
| [`Phase-21-8.md`](./Phase-21-8.md) | FE: 段階をまたぐ移動(05 の詳細バッジ・06 の呼ばれる手順バッジ) | 学習 | 21-7 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{logic,logic_drafting}.py`
  - 新規(テスト): `tests/unit/test_{logic,logic_drafting}.py`
  - 更新: `app/detailed_design/{__init__,validation}.py`、`app/ai/llm/fake.py`、`app/schemas/design_stage.py`、`app/api/routes/design_stages.py`、`app/services/design_stage_generation_service.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{function_list,design_stage_generation}.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/detailed-design/`):
  - 新規: `logicOps.ts`、`components/{LogicSpecEditor,LogicPanel}.tsx`
  - 新規(テスト): `__tests__/logicOps.test.ts`、`components/__tests__/{LogicSpecEditor,LogicPanel}.test.tsx`
  - 新規(画面確認後の修正): `components/StageSaveBar.tsx`、`components/__tests__/StageSaveBar.test.tsx`
  - 更新: `api/{types,designStagesApi}.ts`、`detailed-design-store.ts`、`test-utils/stageFixtures.ts`、`components/{tableStyles.ts,StageWorkArea,ProcedureStepTable,ProcedurePanel}.tsx`
  - 更新(画面確認後の修正): `components/{FunctionListPanel,DataFlowPanel,DataModelPanel,StructurePanel}.tsx` とそのテスト(保存バー)
  - 更新(テスト): `api/__tests__/designStagesApi.test.ts`、`__tests__/detailed-design-store.test.ts`、`components/__tests__/{StageWorkArea,ProcedureStepTable,ProcedurePanel}.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 21-1 | `detailed_design/logic.py`(新規)、`validation.py`・`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | 段階6の正本の形を決め、05 との紐づけを (モジュール, 関数) から導き、段階6を検証する(0件は通す) | `uv run pytest tests/unit/test_logic.py tests/unit/test_function_list.py` |
| 21-2 | `detailed_design/logic_drafting.py`(新規)、`fake.py`(更新) | 1つの関数の詳細を AI に書かせる入力(呼ばれる手順と分岐)を組み立て、出力を変換する | `uv run pytest tests/unit/test_logic_drafting.py` |
| 21-3 | `schemas/design_stage.py`・`design_stage_generation_service.py`・`api/routes/design_stages.py`・`tests/fixtures/detailed_design.py`(更新) | 生成の対象の関数をリクエストから実行まで渡し、対象の関数だけを置き換える | `uv run pytest tests/unit/test_design_stage_generation.py` |
| 21-4 | `api/types.ts`・`api/designStagesApi.ts`・`detailed-design-store.ts`・`stageFixtures.ts`(更新) | 段階6の型、生成に対象の関数を渡す口、段階またぎの移動先 | `npx vitest run src/features/detailed-design/api src/features/detailed-design/__tests__/detailed-design-store.test.ts`、`npx tsc --noEmit` |
| 21-5 | `logicOps.ts`(新規) | 候補・呼ばれる手順・逆引き・L-ID を導き、詳細を編集する | `npx vitest run src/features/detailed-design/__tests__/logicOps.test.ts` |
| 21-6 | `components/LogicSpecEditor.tsx`(新規)、`tableStyles.ts`(更新) | 1関数の詳細を編集する(呼ばれる手順のバッジつき) | `npx vitest run src/features/detailed-design/components/__tests__/LogicSpecEditor.test.tsx` |
| 21-7 | `components/LogicPanel.tsx`(新規)、`StageWorkArea.tsx`(更新) | 段階6の作業領域を組み立てて登録する(飛ばす操作を含む) | `npx vitest run src/features/detailed-design/components/__tests__/LogicPanel.test.tsx src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx` |
| 21-8 | `ProcedureStepTable.tsx`・`ProcedurePanel.tsx`・`LogicPanel.tsx`(更新) | 05↔06 のバッジから相手の段階のタブ・行へ移る | `npx vitest run src/features/detailed-design/components/__tests__/ProcedureStepTable.test.tsx src/features/detailed-design/components/__tests__/ProcedurePanel.test.tsx src/features/detailed-design/components/__tests__/LogicPanel.test.tsx` |

## 写経順序(#23)

章番号順(21-1 → 21-2 → … → 21-8)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、2つの章で少しずつ完成する。各章の担当分には `# Phase-21-<n>:追記` / `// Phase-21-<n>:追記` / `：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `tests/fixtures/detailed_design.py`(21-1 → 21-3。`create_stage6_project` は 21-3)
- `components/LogicPanel.tsx`・`components/__tests__/LogicPanel.test.tsx`(21-7 → 21-8。段階またぎの部分は 21-8)

段階5のファイル(`ProcedureStepTable.tsx`・`ProcedurePanel.tsx`)の更新は、`logicOps`(21-5)と段階6のパネル(21-7)ができた後の 21-8 にまとめた。

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 646件が成功(Phase 20 完了時は 618件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 587件(107ファイル)が成功(`--maxWorkers=4`。並列を絞らないと、デモページの既存のテストが重さで時間切れになることがある)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **マイグレーション**: 不要(段階6の model は JSONB)。
- **samples と本体の一致**: タグとコメントの行を取り除いた samples を、本体と比べた。本 Phase で触った部分に差は無い。残る差は、以前からあった書き方の違いだけである(`fake.py` の import の並び・文字列の折り返し、`test_design_stage_generation.py` の段階1のテストの改行)。バックエンドの samples は Python 3.13 で、フロントエンドの samples は TypeScript のパーサで構文チェックした。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。
  - `logic.py`(21-1)は `procedure`(Phase 20)、`validation.py`(21-1)は `logic`(21-1)を import する。`logic_drafting.py`(21-2)は `logic.LogicDraft`・`PseudoStep`・`logic_key`(21-1)と `procedure`・`structure`・`function_list`・`prompt_rules`(以前の Phase)を import する。`fake.py`(21-2)は `logic_drafting`(21-2)を import する。
  - 生成サービス(21-3)は `logic`(21-1)・`logic_drafting`(21-2)を、ルート(21-3)は `LogicTarget`(21-3 のスキーマ)を使う。`create_stage6_project`(21-3)は既存の `create_stage5_project`・`procedure_model` だけを使う。
  - `logicOps.ts`(21-5)は `procedureOps`(Phase 20)と `LogicModel` などの型(21-4)、`LogicSpecEditor.tsx`(21-6)は `logicOps`(21-5)と `BADGE`(21-6)、`LogicPanel.tsx`(21-7)は `LogicSpecEditor`(21-6)と `MAX_LOGIC_TARGETS`(21-4)を import する。21-8 で使う `focus`・`jumpTo`・`clearFocus` は 21-4、`logicKey`・`logicIdsByKey`・`toLogics` は 21-5 で生まれている。
  - 各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた(21-4 の `api/types.ts` は `stageFixtures.ts` の型の import と `tsc` で確かめる)。
- **章タグの境界(#12)**: 既存のコードの途中に Phase 21 のブロックを足した箇所と、更新の後ろに既存のコードが続く箇所には、後ろの既存コードに章タグが引き継がれないよう「ここから Phase-X-Y の作成分」の再タグを置いた(`__init__.py` の `__all__`、生成サービス、ストア、`ProcedurePanel.tsx` など)。同じ行が Phase 20 と 21 で続けて変わった箇所は、直近の変更(21)だけを旧 → 新で示した(#29)。
- **画面での確認(1回目)**: ユーザーが確認し、2点の修正を依頼した(下の「画面確認後の修正」)。
- **画面確認後の修正の検証**: FE 全体 600件(108ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`lint`(既存の警告1件)・`build` は成功。BE の変更は無い。samples と本体の一致・構文チェックも、修正したファイルについてやり直した。
- **画面での確認(2回目)**: ユーザーがタブの生成ボタンの出し分けを依頼し、段階全体の生成ボタンの削除と逆引き表の移動を手で行った([21-7](./Phase-21-7.md)「画面確認後の修正(2回目)」)。FE 全体 602件が成功。
- **画面での確認(3回目)**: ボタンを押すとタブが一番前に戻る事象の報告を受け、タブの選択をストアに覚えるようにした([21-7](./Phase-21-7.md)「画面確認後の修正(3回目)」)。FE 全体 605件が成功。
- **画面での確認(4回目)**: ユーザーに依頼中。

## 画面確認後の修正

ユーザーが画面を確認して、2点を依頼した(詳細は [`q_a.md`](../q_a.md) の「Phase 21 画面確認後」)。

1. **保存の操作を上部にも置く**: チェックの後に保存しないと生成できないが、保存ボタンが最下部にしか無かった。保存バー(`StageSaveBar`)を作り、段階1〜6のパネルの先頭(状態表示の直下)と最下部の両方に置いた。段階6は「段階6を飛ばす」も並べる([21-7](./Phase-21-7.md))。
2. **段階6を処理ごとのタブにする**: 候補が多いときのチェックの手間と、生成の進み具合の見えにくさへの対策。段階5の処理ごとの外側のタブで、候補と詳細を切り替える。共通の関数の印・他の処理の手順のバッジ・生成済/未生成のラベル・タブ単位の「未選択をすべて選ぶ」と「未生成を生成する(5件まで)」を足し、詳細を 処理 → 関数 の二重のタブにした([21-5](./Phase-21-5.md)・[21-7](./Phase-21-7.md)・[21-8](./Phase-21-8.md))。
   - ユーザー決定: チェックは「06 に載せる関数」のまま(一括選択は未選択だけを選び、生成はボタン、再生成は関数のタブの「作り直す」)。共通の関数は、呼ぶ処理すべてのタブに出す。
   - model・L-ID・逆引き・BE は変えていない(見せ方だけの変更)。

## 後続 Phase への申し送り

- **組み立て(Phase 22)**:
  - 06 章は段階6の `logics`。L-ID は `logic_id`(並び順)、「呼ばれる手順」と逆引きは `logic_candidates`・`calling_steps` で導く。05 の詳細バッジと索引の「詳細(06)」は、手順の (callee, call) と `logic_key` の一致から引く。デモの `toHtml`・`toMarkdown` をバックエンドへ移すときは、`logic` の代わりにこれを使う。
  - 段階6が0件で承認済みなら、06 章は「省略」と出す(着手時の決定1)。
  - 段階7の作業領域(実装計画)は本 Phase では「準備中」のまま。
- **段階5の詳細バッジ**: 段階6の保存済みの内容から出す(承認の有無は問わない)。段階6が開いていないときに押すと、段階6の画面は「まだ始められません」になる。必要なら Phase 22 で、開いていないときはバッジを押せなくする。
- **関数名の書き方の揺れ**: 05 の `call` と 06 の `function` は完全一致でつなぐ(`logic_key` は前後の空白だけを除く)。段階5で `ReservationService.create` と `create` が混ざると、別の関数として候補に出る。段階5の検証で揃えさせるかは、運用の後に判断する。
- **開発環境への反映**: 開発用 DB には、Phase 15・16 のマイグレーション(c1d2e3f4a5b6〜f4a5b6c7d8e9)が未適用のまま(本 Phase はマイグレーションなし)。

## 後続 Phase での改訂

- [Phase 29](../Phase-29/Phase-29-1.md): 段階6の候補(`logic_candidates`)を「関数を呼ぶ行」(`calls_function`)で判定し、段階5の戻りの行を除いた。

## Phase 完了チェック(#22)

1. 段階6の項目に L-ID も「呼ばれる手順」も保存しないことにしたのはなぜか。段階6で関数を選んだとき、段階5の承認に何が起きないかから説明する。
2. 「段階6を飛ばす」を0件の承認にしたのはなぜか。専用の skip API・段階7の入力から段階6を外す案と比べて、陳腐化(「古い」)の伝わり方の点で何が違うか。
3. `UNCALLED_LOGIC` を警告でなくエラーにしたのはなぜか。どんな操作の後にこのエラーが出るか。
4. 段階6の生成の入力に要件定義(技術スタック)を渡さなかったのはなぜか。シグネチャの言語はどこから判断させているか。
5. 段階をまたいで移るとき、移動先をストアの `focus` に置き、移動先のパネルが作られたときに一度だけ読んで消すのはなぜか。消さないと何が起きるか。
