# Phase 16 導入: 段階1 機能(処理)一覧(ステージ4)

## 目的

詳細設計モードの段階1「機能(処理)一覧」を、下書き → 編集 → 承認まで通して動かす。[`docs/external_design.md`](../../docs/external_design.md) 2.7節の段階表の1行目に当たる。

- **外部設計書の API 一覧**: 外部設計書に「2.6 API一覧」(メソッド/パス/概要/関連画面)の節を足す。簡易ドキュメントモード・詳細設計モードの両方で出す。
- **段階1の意味モデル**: 処理ID(`F-01`…)・名称・種別・トリガー・関連画面・機能グループ・概要の表。処理IDは再生成しても変えない。機能グループの初期値は API のパスから決定的に作る。
- **段階ごとの検証**: 段階1が最初の消費者なので、検証を登録する仕組み(`STAGE_VALIDATORS`)をここで作る。エラーがあると承認できない。
- **AI の下書きの生成**: 外部設計書から処理を下書きする。文書・UML 図と同じく、受け付けてからバックグラウンドで生成し、画面はポーリングで待つ。
- **SCR-008 の段階1の作業領域**: 下書きの生成、機能グループと機能一覧の表の編集、検証の結果、保存。

## 着手時の相談で決めたこと

詳細は [`textbook/q_a.md`](../q_a.md) の「Phase 16 開始時」を参照。

1. **Phase 16 は段階1だけにする**(ユーザー回答)。段階2(データフロー)は Phase 17 に送り、以降の番号を1つずつ送る(ステージ4は Phase 14〜21 になる)。段階2は、内部設計書の `DF-n` 節を前提にした既存の DFD 生成を、段階1の機能グループから入力を作れるように組み替える必要があり、1セッションに収まらないため。
2. **外部設計書に API 一覧の節を足す。両方のモードで出す**(ユーザー回答。一度「詳細設計モードだけ」と答えた後、両方に変えた)。それまでの外部設計書には自システムの API 一覧が無く(2.4節は外部連携だけ)、「機能グループの初期値を API のリソース名から作る」([Phase-14](../Phase-14/Phase-14-1.md) の決定#3)の材料が無かった。
   - 簡易ドキュメントモードでは、内部設計書 3.3 の API 表と内容が重なる。内部設計書のプロンプトに「外部設計書 2.6 と同じメソッド・パスを使い、内部の担当の観点で概要を書く」と一言足して、両者をそろえた。

Claude の判断で決めたこと(計画の承認で確定):

- **処理IDの安定**: AI には ID を書かせない。前の版の行とトリガー(メソッド+正規化したパス)で突き合わせ、一致した行は ID と人が確定した機能グループを引き継ぐ。新しい行は `next_number` から振り、消えた番号は再利用しない(16-2)。
- **検証は「保存は通し、承認で止める」**: UML 図の承認と同じ考え方にした。編集の途中の状態も保存できる(16-2・16-3)。
- **下書きの生成は BackgroundTasks+ポーリング**: `design_stages` に生成の状態の列を3つ足した。生成中は、その段階の生成・保存・承認を 409 で断る。15分で回収する(16-3・16-4)。
- **下書きの陳腐化**: 当初は扱わない(承認時だけ記録)としたが、画面の確認で「作り直しても『古い』が消えない」問題が見つかり、生成の完了時にも入力の版を記録するように改めた(16-4)。

作業後の画面の確認で足したこと(ユーザーの質問・要望。詳細は [`q_a.md`](../q_a.md)):

- **種別「画面」**: サーバーを呼ばずに画面の中で完結する、非自明な演算・描画を機能一覧に載せる(16-2・16-4)。
- **状態「再生成済(未承認)」**: 内容のある段階を作り直したときの状態。保存する状態に `regenerated` を足した(16-4・16-6)。
- **ダークモードのセレクト**: 機能一覧の表のセレクトの選択肢を、テーマの色にした(16-6)。

## パイプライン上の位置づけ・前提

```
外部設計書: 文書生成 → 2.6 API一覧(両モード)                                           (16-1)
段階1:   POST /design-stages/1/generate ─ 受け付け(生成中に)→ BackgroundTasks           (16-4)
           execute: 外部設計書 → AI(処理の列挙だけ)→ merge_draft(ID・機能グループ)→ draft  (16-2, 16-4)
         GET /design-stages ─ 止まった生成の回収 → 状態+issues(段階ごとの検証)           (16-3, 16-4)
         PUT /design-stages/1(人の編集)→ POST .../approve(検証にエラーが無いこと)        (16-3)
[FE]:    SCR-008 段階1 = FunctionListPanel(生成・確認・ポーリング・表の編集・保存)       (16-5, 16-6)
```

- **前提として読むもの**:
  - [`Phase-15-2.md`](../Phase-15/Phase-15-2.md): 段階の状態・承認・陳腐化の土台。本 Phase はその上に段階1の中身を載せる。
  - [`Phase-15-introduction.md`](../Phase-15/Phase-15-introduction.md)「後続 Phase への申し送り」: 下書きは `draft`、人の保存は `reviewing`。
  - [`Phase-10-introduction.md`](../Phase-10/Phase-10-introduction.md): UML 図の生成の受け付け・実行・失敗の理由の残し方。段階の下書きの生成も同じ形にした。
  - [`appendix/detailed-design-devex/content.py`](../../appendix/detailed-design-devex/content.py) の `FUNCTIONS`: 段階1の列の見本。
- **本 Phase 開始時点の状態**:
  - 段階の `model` は自由な JSON で、形も検証も無かった。SCR-008 の作業領域は「準備中」の表示だけだった。
  - 外部設計書に、自システムの API 一覧が無かった。

## モード宣言(#21)

- **16-5 を納期モード**にする。条件(a): API クライアントと型の拡張で、定型が過半。条件(b): コアループ(チャット → 4文書生成)ではない付随作業。
- **残りの章は学習モード**。
  - 16-1 は、コアループの文書生成(外部設計書・内部設計書のプロンプト)を変えるため。
  - 16-2・16-3・16-4 は、処理IDの引き継ぎ・検証の登録・生成の受け付けと実行の分け方という設計判断そのものだから。
  - 16-6 は、編集中の内容を手元に持つか・いつ承認を止めるか、という画面側の判断を含むため。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-16-1.md`](./Phase-16-1.md) | BE: 外部設計書の 2.6 API一覧(プロンプト)と、その表の読み取り(純粋) | 学習 | なし |
| [`Phase-16-2.md`](./Phase-16-2.md) | BE: 段階1の意味モデル、処理IDの採番と引き継ぎ、機能グループの初期値、段階ごとの検証(すべて純粋) | 学習 | 16-1 |
| [`Phase-16-3.md`](./Phase-16-3.md) | BE: 段階の生成の状態の列、承認時の検証、読み取りの `issues`、生成中の保存・承認の拒否 | 学習 | 16-2 |
| [`Phase-16-4.md`](./Phase-16-4.md) | BE: 段階1の下書きの生成(構造化出力・受け付けと実行・失敗の理由・回収)と API | 学習 | 16-3 |
| [`Phase-16-5.md`](./Phase-16-5.md) | FE: API・型(段階1の型、生成の API、生成の状態と `issues`) | 納期 | 16-4 |
| [`Phase-16-6.md`](./Phase-16-6.md) | FE: 段階1の作業領域(生成と確認・ポーリング・機能グループと表の編集・検証の結果・保存) | 学習 | 16-5 |

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{api_list,function_list,validation,drafting}.py`、`app/services/design_stage_generation_service.py`、`alembic/versions/f4a5b6c7d8e9_add_generation_to_design_stages.py`
  - 新規(テスト): `tests/unit/test_{external_api_list,function_list,design_stage_generation}.py`
  - 更新: `app/services/{doc_generator_service,design_stage_service,errors}.py`、`app/ai/llm/fake.py`、`app/detailed_design/__init__.py`、`app/models/design_stage.py`、`app/repositories/design_stage.py`、`app/schemas/design_stage.py`、`app/api/routes/design_stages.py`
  - 更新(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_design_stage_service.py`
- **フロントエンド**(`textbook/samples/frontend/src/features/detailed-design/`):
  - 新規: `functionListOps.ts`、`hooks/useStageGenerationPolling.ts`、`components/FunctionListPanel.tsx`
  - 新規(テスト): `__tests__/functionListOps.test.ts`、`hooks/__tests__/useStageGenerationPolling.test.ts`、`components/__tests__/FunctionListPanel.test.tsx`
  - 更新: `api/{types,designStagesApi}.ts`、`test-utils/stageFixtures.ts`、`detailed-design-store.ts`、`labels.ts`、`components/{StageWorkArea,DetailedDesignPageContent}.tsx`
  - 更新(テスト): `api/__tests__/designStagesApi.test.ts`、`__tests__/{labels,detailed-design-store}.test.ts`、`components/__tests__/{StageWorkArea,DetailedDesignPageContent}.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 16-1 | `doc_generator_service.py`・`fake.py`(更新)、`detailed_design/api_list.py`(新規) | 外部設計書に API 一覧を書かせ、その表を見出しの名前で読む | `uv run pytest tests/unit/test_external_api_list.py tests/unit/test_doc_generator_service.py` |
| 16-2 | `detailed_design/{function_list,validation}.py`(新規)、`__init__.py`・`tests/fixtures/detailed_design.py`(更新) | AI の下書きを前の版と突き合わせて処理IDと機能グループを決め、段階1を検証する | `uv run pytest tests/unit/test_function_list.py` |
| 16-3 | マイグレーション(新規)、`models`・`repositories`・`schemas/design_stage.py`・`errors.py`・`design_stage_service.py`(更新) | 生成の状態を持ち、承認を検証で止め、読み取りに指摘を載せる | `uv run pytest tests/unit/test_design_stage_service.py tests/unit/test_detailed_design_stages.py` |
| 16-4 | `detailed_design/drafting.py`・`design_stage_generation_service.py`(新規)、`routes/design_stages.py`・`errors.py`・`fake.py`(更新) | 下書きの生成を受け付けて裏で実行し、失敗の理由を残し、止まった生成を回収する | `uv run pytest tests/unit/test_design_stage_generation.py` |
| 16-5 | `api/{types,designStagesApi}.ts`・`test-utils/stageFixtures.ts`(更新) | 段階1の型と生成の API を足す | `npx vitest run src/features/detailed-design/api` |
| 16-6 | `functionListOps.ts`・`useStageGenerationPolling.ts`・`FunctionListPanel.tsx`(新規)、ストア・`labels.ts`・`StageWorkArea.tsx`・`DetailedDesignPageContent.tsx`(更新) | 下書きを生成・編集・保存し、保存していない編集や検証のエラーがあるうちは承認させない | `npx vitest run src/features/detailed-design "src/app/(pages)/(protected)/projects/[id]/detailed-design"` |

## 写経順序(#23)

章番号順(16-1 → 16-2 → … → 16-6)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-16-<n>:追記` / `# Phase-16-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/detailed_design/__init__.py`(16-1 → 16-2)
- `app/ai/llm/fake.py`(16-1 → 16-4)
- `app/services/errors.py`・`app/services/design_stage_service.py`・`app/models/design_stage.py`(16-3 → 16-4)
- `test-utils/stageFixtures.ts`(16-5 → 16-6)

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 504件が成功(Phase 15 完了時は 476件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 447件(86ファイル)が成功(`--maxWorkers=4`)。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
- **マイグレーション**: 使い捨ての Postgres 17 のコンテナで、`upgrade head` → `downgrade -1` → `upgrade head` が通り、`design_stages` に3列ができることを確かめた。
- **samples と本体の一致**: タグと旧コードのコメントを取り除いた samples を、本体と比べた。差は、JSX の中のコメント(`{/* */}`)の置き場所だけである。
  - 全サンプル(バックエンド)を Python 3.13 で構文チェックした。Phase 15 で作った2ファイル(`doc_generator_service.py`・`services/project.py`)の文書文字列の中に、`"""` を含む旧コードのコメントが入っていて、構文エラーになっていた。タグを文書文字列の外へ出して直した。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた(マイグレーションは従来どおり対象外)。

## 後続 Phase への申し送り

- **段階2(Phase 17)**:
  - DFD の生成の入力を、内部設計書の `DF-n` 節から「段階1の機能グループと処理」に切り替える。`uml_generation_service` の対象の列挙(`extract_dfd_subjects`)・入力の組み立て(`build_source_text`)・`source_doc_versions` が内部設計書に結び付いている。
  - 自動レイアウトの時間の上限と案C(Phase 15 の申し送り)も、段階2で判断する。
  - 生成できる段階の対応表 `STAGE_GENERATORS` と検証の `STAGE_VALIDATORS` に、段階2を登録する。
- **既存のプロジェクト**: API 一覧の節は、外部設計書を生成し直したときから入る。古い外部設計書のままでも段階1の下書きは作れるが、「API 一覧に無い」の照合(MISSING_API)は働かない。
- **開発環境への反映**: 開発用 DB には、Phase 15 のマイグレーション(c1d2e3f4a5b6〜e3f4a5b6c7d8)と本 Phase の f4a5b6c7d8e9 が未適用である。

## 後続 Phase での改訂

- 申し送りの「段階2(Phase 17)」の3点は、[Phase 17](../Phase-17/Phase-17-introduction.md) で回収した(DFD の入力を段階1の機能グループに切り替え、`STAGE_GENERATORS`・`STAGE_VALIDATORS` に段階2を登録。自動レイアウトの上限は据え置き、案C は実施しない)。あわせて、生成の関数の引数を `StageGenerationContext` にまとめ(17-3)、`FunctionListPanel` の表の見た目と検証の結果の一覧を共有の部品に切り出した(17-6)。

## Phase 完了チェック(#22)

1. AI に処理IDを書かせず、前の版の行とトリガーで突き合わせて決めるのはなぜか。消えた番号を再利用しない理由も、後の段階の参照から説明できるか。
2. 機能グループの初期値を、AI の提案ではなく API のパスから決定的に作る利点は何か。人が確定した値を再生成で上書きしない仕組みはどこにあるか。
3. 検証を「保存は通し、承認で止める」にした理由と、エラーと警告を分けた理由(MISSING_API が警告である理由)を説明できるか。
4. 下書きの生成を「受け付け」と「実行」に分け、生成中は保存・承認も 409 にした理由を説明できるか。15分での回収が無いと何が起きるか。
5. 画面で、編集中の内容をストアではなく作業領域の中に持ち、保存していない編集があるうちは承認ボタンを止めた理由を説明できるか。
