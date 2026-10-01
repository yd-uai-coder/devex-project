# Phase 15 導入: モードと段階の土台+既存機能の修正(ステージ4)

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節 ステージ4の「Phase 15: モードと段階の土台+既存機能の修正」を実装する。決定の根拠は [Phase-14-5](../Phase-14/Phase-14-5.md) にある。

- **モード**: プロジェクトの作成時に、簡易ドキュメントモードか詳細設計モードかを選ぶ(`projects.mode`)。詳細設計モードは、ヒアリングの後に要件定義・外部設計の2文書だけを生成する。
- **段階の土台**: 詳細設計モードの段階1〜7の状態・承認・陳腐化(`design_stages`)と、段階を進める画面(SCR-008)の骨格を作る。段階ごとの中身(AI の下書き・表や図の編集)は Phase 16 以降で作る。
- **簡易ドキュメントモードのモジュール一覧**: 内部設計書のプロンプトに、ファイル単位の責務表を足す。
- **出力見本の気づき#1〜#10の修正**: [`appendix/detailed-design-devex/`](../../appendix/detailed-design-devex/README.md) の付録で見つかった10件を直す。自動レイアウトの高速化(#10)も含む。

## 実装前の設計判断(このセッションで確定)

着手前の相談で、次の3点を確定した。詳細は [`textbook/q_a.md`](../q_a.md) を参照。

1. **古い「生成中」を回収するしきい値は15分**(気づき#5)。UML 図の生成は、1回で最大5対象を直列に処理する。1対象あたり再試行込みで1〜2分かかるため、正常な生成を誤って止めない長さを取った。
2. **回収は、文書生成の `projects.status='generating'` にも適用する**。#4 で生成中の要求を 409 にすると、再起動で止まったプロジェクトは二度と生成できなくなるため。
3. **`generated_documents` に UNIQUE(project_id, doc_type, version) を足す**(#4 の補強)。既存の重複は自動で消さず、マイグレーションを止める。

Claude の判断で決めたこと(計画の承認で確定):

- **モード選択ダイアログ**: 作成画面は、ダイアログではなく独立したページ(`/projects/new`)である。そこで、ダッシュボードのボタンでダイアログを開き、選んだ結果を `/projects/new?mode=` で渡す。
- **段階の状態**: DB に保存するのは `draft`/`reviewing`/`approved` の3つだけにする。「未着手」と「古い」は純粋関数で導く(15-2)。段階の範囲は **1〜7** にした。段階7(実装計画)も、同じ承認の流れに乗せるためである。docs ⑩ の「1〜6」を直した。
- **段階ごとの検証の登録の仕組みは作らない**(#17)。この Phase には、それを使う実在の消費者がいない。承認の条件は、全段階に共通の3つ(開いている・版が一致する・承認できる状態で内容が空でない)だけにした。
- **#7 の Tavily**: 汎用チャットの独自の再試行は、Tavily(検索)の利用上限超過もクォータ超過として扱っていた。共通の判定(`llm_retry._is_quota_error`)をそこまで広げてから寄せた。
- **#8**: `REFRESH_TOKEN_EXPIRE_DAYS=14` にし、Cookie の寿命をこの設定から導く。
- **詳細設計モードの文書画面**: 「設計図を生成する」を隠し、「詳細設計へ進む」を出す(内部設計書が無いため)。
- **devex-api のブランチ**: `stage3` から `stage4` を切った(ユーザー回答)。

## パイプライン上の位置づけ・前提

```
作成:   ダッシュボード ─[新規作成]→ ModeSelectDialog ─?mode=→ /projects/new → POST /projects(mode)     (15-7, 15-1)
生成:   POST /generate ─ request_generation(409・回収)→ generating → generate(モードごとの文書)       (15-3, 15-1)
          失敗: rollback → 状態を戻す → 通知だけ commit                                              (15-3)
チャット: POST /chat(SSE)─ 途中の失敗 → event: error {code, detail} → 画面に理由を表示                 (15-3, 15-6, 15-8)
段階:   GET/PUT/POST design-stages ─ derive_states(未着手/下書き/レビュー中/承認済み/古い)            (15-2)
[FE]:   SCR-008 = StageStepper(1〜7)+ StageWorkArea(足りない入力・古い・承認)                      (15-7)
```

- **前提として読むもの**:
  - [`Phase-14-5.md`](../Phase-14/Phase-14-5.md): モード選択・段階の進め方・気づき10件の対応方針。
  - [`Phase-14-4.md`](../Phase-14/Phase-14-4.md): Phase 15〜20 の成果物と依存関係。
  - [`Phase-13-3.md`](../Phase-13/Phase-13-3.md): 「等しくない」で比べる陳腐化の判定。15-2 の段階の陳腐化は同じ方式である。
  - [`Phase-12-introduction.md`](../Phase-12/Phase-12-introduction.md): 承認しても `version` を増やさない、保存すると承認をやり直す、という状態の流れ。段階も同じ形にした。
- **本 Phase 開始時点の状態**:
  - プロジェクトにモードは無く、作成は直接 `/projects/new` へ進む。
  - 本体のルートは `template_id` をサービスへ渡していなかった。samples は Phase 6-3 から渡しており、本体の写経で抜けていた。`GenerationFailedError` の `code = "LLM_API_ERROR"` も同じで、samples(Phase 2-5)にはあり、本体に無かった。
  - 文書生成は、失敗すると途中までの版を commit したまま状態を戻していた。生成中の二度押しも通っていた。
  - 自動レイアウトは、9要素・18本の DFD で65〜106秒かかっていた。

## モード宣言(#21)

- **15-4 と 15-6 を納期モード**にする。
  - 15-4 の条件(a): 共通の部品への置き換え・設定値の統一・未使用ファイルの削除で、定型が過半。条件(b): コアループではない(汎用チャットはテンプレート由来のデモ)。
  - 15-6 の条件(a): API クライアント・型・SSE のパースの拡張で、定型が過半。条件(b): コアループではない。
- **残りの章は学習モード**。
  - 15-1・15-3 は、コアループ(チャット → 文書生成)の挙動を変えるため。
  - 15-2・15-7 は、段階の状態の設計判断そのものだから。
  - 15-5 は、アルゴリズムの比較と取捨の判断だから。
  - 15-8 は、確認ダイアログという定型の部品が中心だが、生成ボタン(コアループの入口)とチャットの失敗の見せ方を変えるため。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-15-1.md`](./Phase-15-1.md) | BE: `projects.mode`、`template_id` の受け渡し(#1)、モードごとの生成、モジュール一覧のプロンプト | 学習 | なし |
| [`Phase-15-2.md`](./Phase-15-2.md) | BE: `design_stages` の土台(状態の導出と陳腐化(純粋)、取得・保存・承認の API) | 学習 | 15-1 |
| [`Phase-15-3.md`](./Phase-15-3.md) | BE: 生成の失敗と固着(rollback #3、409 と一意制約 #4、15分での回収 #5、SSE の失敗イベント #2) | 学習 | 15-1 |
| [`Phase-15-4.md`](./Phase-15-4.md) | BE: 整理(汎用チャットの再試行の共通化 #7、refresh の14日化 #8、未使用ファイルの削除 #9) | 納期 | 15-3 |
| [`Phase-15-5.md`](./Phase-15-5.md) | BE: 自動レイアウトの高速化(#10。近似で並べ、簡易な実経路で仕上げる) | 学習 | なし |
| [`Phase-15-6.md`](./Phase-15-6.md) | FE: API・型(モード、段階の API、SSE の `event: error`) | 納期 | 15-1〜15-3 |
| [`Phase-15-7.md`](./Phase-15-7.md) | FE: モード選択ダイアログ、文書画面の出し分け、SCR-008 の骨格 | 学習 | 15-6 |
| [`Phase-15-8.md`](./Phase-15-8.md) | FE: 確認ダイアログ(生成・再生成 #4、承認済みの図の再生成 #6)、チャットの失敗の表示(#2) | 学習 | 15-6, 15-7 |

15-4 が 15-3 に依存するのは、`llm_retry.py` に 15-3 で足した `as_llm_error` の後ろへ、15-4 の `_is_quota_error` の拡張を書くためである。

## サンプルコード一覧

- **バックエンド**(`textbook/samples/backend/`、`devex-api/backend/` と同じ相対パス):
  - 新規: `app/detailed_design/{__init__,stages}.py`、`app/models/design_stage.py`、`app/repositories/design_stage.py`、`app/schemas/design_stage.py`、`app/services/{design_stage_service,generation_staleness,chat}.py`(`chat.py` はテンプレート由来で、samples へは初めて載せた)、`app/api/routes/design_stages.py`、`alembic/versions/{c1d2e3f4a5b6,d2e3f4a5b6c7,e3f4a5b6c7d8}_*.py`
  - 新規(テスト): `tests/fixtures/detailed_design.py`、`tests/unit/test_{project_mode,detailed_design_stages,design_stage_service,generation_staleness,doc_generation_guard,uml_stale_generation,chat_stream_errors,generic_chat_and_refresh,uml_layout_crossing_reduction}.py`
  - 更新: `app/models/{project,generated_document,__init__}.py`、`app/schemas/project.py`、`app/repositories/{project,uml_diagram,uml_generation_run}.py`、`app/services/{project,doc_generator_service,chat_service,llm_retry,uml_generation_service,errors}.py`、`app/api/routes/{projects,uml,auth,__init__}.py`、`app/core/config.py`、`app/uml/generation/{failures,__init__}.py`、`app/uml/layout/crossing_reduction.py`
  - 削除: `app/infrastructure/http.py`(samples には元から無い)
- **フロントエンド**(`textbook/samples/frontend/`。ページは samples の慣例どおり `src/app/<ルート>/` に置いた。本体では `src/app/(pages)/(protected)/<ルート>/`):
  - 新規: `src/features/detailed-design/{api/{types,designStagesApi}.ts,labels.ts,detailed-design-store.ts,components/{StageStepper,StageWorkArea,DetailedDesignPageContent}.tsx,test-utils/stageFixtures.ts}`、`src/features/dashboard/components/ModeSelectDialog.tsx`、`src/features/hearing/components/NewProjectPageContent.tsx`、`src/components/ui/layout-blocks/ConfirmDialog.tsx`、`src/app/projects/[id]/detailed-design/page.tsx`
  - 新規(テスト): 上記の `__tests__/`、`src/features/dashboard/api/__tests__/projects.test.ts`、`src/features/uml/__tests__/labels.test.ts`
  - 更新: `src/features/dashboard/api/projects.ts`、`src/features/hearing/{api/{createProject,streamChat}.ts,components/{IntakeForm,ChatPanel,HearingCompletionBanner}.tsx,hearing-store.ts}`、`src/features/documents/{documents-store.ts,components/DocumentsPageContent.tsx}`、`src/features/uml/{api/types.ts,labels.ts,components/GenerationPanel.tsx}`、`src/app/dashboard/page.tsx`、`src/app/projects/new/page.tsx`
  - 更新(テスト): 上記の各 `__tests__/` と、`src/app/{dashboard,projects/new}/__tests__/page.test.tsx`

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 15-1 | `models/project.py`・`schemas/project.py`・`repositories/project.py`・`services/project.py`・`routes/projects.py`・`doc_generator_service.py`(更新)、マイグレーション(新規) | 作成時のモードを保存し、モードごとの文書の組を生成する。ルートから `template_id` を渡す | `uv run pytest tests/unit/test_project_mode.py tests/unit/test_project_service.py tests/unit/test_doc_generator_service.py` |
| 15-2 | `app/detailed_design/stages.py`・モデル・リポジトリ・スキーマ・サービス・ルート(新規)、`errors.py`・`routes/__init__.py`・`models/__init__.py`(更新) | 段階の5つの状態を導き、開いている段階だけを保存・承認する。承認時に入力の版を記録する | `uv run pytest tests/unit/test_detailed_design_stages.py tests/unit/test_design_stage_service.py` |
| 15-3 | `generation_staleness.py`(新規)、`doc_generator_service.py`・`uml_generation_service.py`・`chat_service.py`・`llm_retry.py`・`routes/{projects,uml}.py`・`models/generated_document.py` ほか(更新) | 失敗は巻き戻してから知らせ、二重実行を塞ぎ、止まった「生成中」を回収する | `uv run pytest tests/unit/test_generation_staleness.py tests/unit/test_doc_generation_guard.py tests/unit/test_uml_stale_generation.py tests/unit/test_chat_stream_errors.py tests/unit/test_uml_generation_service.py` |
| 15-4 | `services/chat.py`・`llm_retry.py`・`routes/auth.py`・`core/config.py`(更新)、`infrastructure/http.py`(削除) | 汎用チャットも共通の再試行を通し、refresh の寿命を1か所から導く | `uv run pytest tests/unit/test_generic_chat_and_refresh.py tests/unit/test_llm_retry.py` |
| 15-5 | `app/uml/layout/crossing_reduction.py`(更新) | 行の順を近似で決め、簡易な実経路で仕上げる(回数・時間の上限つき) | `uv run pytest tests/unit/test_uml_layout_crossing_reduction.py tests/unit/test_uml_layout_pipeline.py` |
| 15-6 | `projects.ts`・`createProject.ts`・`streamChat.ts`(更新)、`detailed-design/api/*`(新規) | モードを送り、段階の API を呼び、SSE の失敗イベントを `code` 付きの例外にする | `npx vitest run src/features/hearing/api src/features/detailed-design/api` |
| 15-7 | `ModeSelectDialog.tsx`・`NewProjectPageContent.tsx`・`detailed-design/*`(新規)、ダッシュボード・作成画面・`IntakeForm.tsx`・`documents-store.ts`・`DocumentsPageContent.tsx`(更新) | モードを選ばせて作成し、詳細設計モードでは SCR-008 へ進ませる | `npx vitest run src/features/dashboard "src/app/(pages)/(protected)/dashboard" "src/app/(pages)/(protected)/projects/new" src/features/hearing/components/__tests__/IntakeForm.test.tsx src/features/documents src/features/detailed-design "src/app/(pages)/(protected)/projects/[id]/detailed-design"` |
| 15-8 | `ConfirmDialog.tsx`(新規)、`HearingCompletionBanner.tsx`・`ChatPanel.tsx`・`hearing-store.ts`・`DocumentsPageContent.tsx`・`documents-store.ts`・`GenerationPanel.tsx`・`uml/{api/types,labels}.ts`(更新) | 取り消しにくい生成の前に確認し、二度押しを防ぎ、チャットの失敗の理由を見せる | `npx vitest run src/components/ui/layout-blocks src/features/hearing src/features/uml/components/__tests__/GenerationPanel.test.tsx src/features/uml/__tests__/labels.test.ts src/features/documents` |

## 写経順序(#23)

章番号順(15-1 → 15-2 → … → 15-8)に進める。各章の中は依存順(#30)で、順番は各章の表を参照。

次のファイルは、複数の章で少しずつ完成する。各章の担当分には `# Phase-15-<n>:追記` / `# Phase-15-<n>：更新` のタグを付けてある。写経するときは、その章までのタグの部分だけを書く。

- `app/services/errors.py`(15-2 → 15-3)
- `app/services/doc_generator_service.py`・`app/api/routes/projects.py`・`app/services/project.py`(15-1 → 15-3)
- `app/services/llm_retry.py`(15-3 → 15-4)
- `app/models/project.py`(15-1 → 15-2)
- `src/features/dashboard/api/projects.ts`(15-6 → 15-7)
- `src/features/documents/{documents-store.ts,components/DocumentsPageContent.tsx}` とそのテスト(15-7 → 15-8)

## Stage 4 固有の運用(Stage 3 から継続)

`textbook/samples/` への反映と並行して、Claude が本体に直接実装する([Phase-14-5](../Phase-14/Phase-14-5.md) 決定3)。対象は `devex-api`(`stage4` ブランチ)と `devex-ui`(`main`)。samples 側の Phase タグは本体には書かない。

## 検証結果

- **BE(Phase 完了時の全体テスト)**: 全体 476件が成功(Phase 13 完了時は 428件)。`ruff check .` は全通過。`uvx pyright` は既知の1件(`app/ai/llm/gemini.py` の `E2eFakeLLM`)のみ。
- **FE(Phase 完了時の全体テスト)**: 全体 428件(83ファイル)が成功。`tsc --noEmit`・`build` は成功。`lint` は既存の警告1件だけ(`streamChat.test.ts`)。
  - 既定の並列数で全体を流すと、負荷で既存のフォームのテスト(`RegisterForm`・`IntakeForm` など)が5秒のタイムアウトに当たることがあった。単体では通り、`--maxWorkers=4` では全件が通る。
- **マイグレーション**: 使い捨ての Postgres 17 のコンテナで、`upgrade head` → `downgrade -3` → `upgrade head` が通ることを確かめた。`design_stages` の CHECK と一意制約、`generated_documents` の一意制約ができていた。
  - 開発用 DB を読み取りだけで調べ、版の番号の重複が0件であることを確かめた(一意制約のマイグレーションは止まらない)。
- **samples と本体の一致**: タグと旧コードのコメントを取り除いた samples を、本体と比べた。今回増えた差は、コメントの置き場所の違いだけである。JSX の属性の中のように、タグを書けない箇所は、ファイル冒頭の注記にまとめた(`GenerationPanel.tsx`)。
- **実 import 監査(#15)**: 章の順に全ファイルの import 文を読み、前方 import が無いことを確かめた。各章のテストが、その章で作成・更新した全ファイルを import するかも突き合わせた。漏れていた次のものにはテストを足した。
  - 15-2: `models/__init__`・`routes/__init__`・`DesignStage`
  - 15-3: `GeneratedDocument` の一意制約
  - 15-7: `toProjectMode`
  - 15-8: `REASON_LABELS`
  - 型だけの変更(15-6 の `ProjectRead.mode`、15-8 の `GenerationReasonCode`)は、`tsc` で確かめた。
- **自動レイアウトの所要時間と交差数**: 新旧の比較は [15-5](./Phase-15-5.md) の表を参照。

## 後続 Phase への申し送り

- **段階の中身**(Phase 16〜20): 段階ごとの AI の下書き・意味モデルの形・表や図の編集・段階ごとの検証は、各段階の Phase で足す。
  - 下書きの生成で行を作るときは、状態を `draft` にする(人の保存は `reviewing`)。
  - 下書きを作ったときにも `input_fingerprint` を記録すれば、承認前の下書きの陳腐化も出せる。今は承認のときにだけ記録している。
  - 段階6(任意)を飛ばす操作は Phase 19 で決める。今の承認の条件では、段階7の入力に段階6の承認が要る。
- **SCR-008 の作業領域**: 今は「準備中」の表示だけである。「再生成」ボタン(古い段階を作り直す)も、各段階の生成ができてから足す。
- **自動レイアウト**: 新方式は所要時間を時間の上限(約15〜20秒)に収めたが、交差数は旧方式より多い場面がある([15-5](./Phase-15-5.md))。案C(外部の役者とデータストアを別のレーンに分ける)は試していない。Phase 16 で機能グループごとの DFD を作るときに、見た目と合わせて判断する。
- **出力見本の付録**: 気づき#1〜#10は本 Phase で直した。[`content.py`](../../appendix/detailed-design-devex/content.py) の付録の表は更新していない(見本は Phase 14 時点のコードの写しのため)。
- **開発環境への反映**: 本体は `stage4` に切り替わっている。開発用 DB にマイグレーションを当てるまでは、起動中の backend が `projects.mode` の無い DB を読んでエラーになる。

## 後続 Phase での改訂

(なし)

## Phase 完了チェック(#22)

1. 段階の状態を DB に3つだけ保存し、「未着手」と「古い」を導くことにした理由を説明できるか。前の段階を編集した時点で後ろの段階に「古い」が出る仕組み(承認済みでない段階の「今の値」を `None` にする)も説明できるか。
2. 文書生成の失敗時に、rollback してから状態を戻し、通知だけを commit する順番にした理由を、`create_version` の flush と「4文書の組」から説明できるか。
3. 生成中の要求を 409 にしただけでは足りず、15分での回収と一意制約を併せた理由を説明できるか(それぞれが塞ぐ穴は何か)。
4. SSE で途中の失敗をステータスコードではなく `event: error` で伝える理由と、そのときバックエンドが発話を残さないので画面も表示を取り消す、という対応を説明できるか。
5. 自動レイアウトで、近似の評価(中心を結ぶ線分)だけでは交差数が悪化した理由と、簡易な実経路の評価で仕上げる段を足した理由を説明できるか。
