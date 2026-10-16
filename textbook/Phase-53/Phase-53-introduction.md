# Phase 53 導入: レビューの画面

## 目的

[Phase 52](../Phase-52/Phase-52-introduction.md) で作ったレビューの土台に、画面と、画面が要る API を足す。見せ方はデモ `/design-review-demo`([51-3](../Phase-51/Phase-51-3.md))で決めてある。

- 区切りを3つにする(文書の生成の後・段階6の承認の後・段階7の承認の後)。段階の区切りの入力・版・状態と、チャットの知らせを一行に縮める ── [53-1](./Phase-53-1.md)
- 区切りの一覧と、指摘の採否の API ── [53-2](./Phase-53-2.md)
- 画面の API・意味モデル・ストア ── [53-3](./Phase-53-3.md)
- レビューのパネル(プレビュー SCR-005・作業領域 SCR-008 で共通)と、対象へ飛ぶ仕組み ── [53-4](./Phase-53-4.md)
- 段階6・7 の承認のダイアログの「AI 設計レビューをする」と、手順書の生成のときの知らせ ── [53-5](./Phase-53-5.md)

差し戻し(採用した指摘から再生成の指示・再ヒアリング)は Phase 54([51-5](../Phase-51/Phase-51-5.md))。この Phase の採否は記録するだけ。

## パイプライン上の位置づけ・前提

```
[文書の生成] ──完了── 自動のレビュー(documents)──┐
[段階6の承認] ── ボタン ── レビュー(stage6)────────┤→ review_runs / review_findings(版に結ぶ)
[段階7の承認] ── ボタン ── レビュー(stage7)────────┘        │
                                                          ├→ チャット: 件数の一行
                                                          └→ レビューのパネル(区切りの表・指摘の表・採否)
[手順書の生成] ── 未レビュー・失敗の区切りがあれば知らせる(止めない)
```

- **前提として読むもの**: [`docs/external_design.md`](../../docs/external_design.md) 2.11節、[`docs/internal_design.md`](../../docs/internal_design.md) 3.3節「8.」(この Phase で区切りと API を書き足した)、[51-2](../Phase-51/Phase-51-2.md) の決定2(区切り)、[Phase 52 の introduction](../Phase-52/Phase-52-introduction.md) の申し送り。
- **今の仕組み**: 段階の承認は `DesignStageService.approve`。承認した版は `design_stages.approved_version`、画面の「古い」は `derive_states` が導く。詳細設計書の md は `DetailedDesignExportService.collect(render=False)` → `to_markdown`・`to_plan_markdown`(段階7の下書きの入力と同じ組み立て)。作業領域の「段階Nで直す」「表で見る」は、ストアの `jumpTo`・`showInTable` と `resolveFixTarget`(Phase 44)。
- **この Phase を始めた時点の状態**: Phase 52 までコミット済み。devex-ui はユーザー(`/users/me`)をどこからも読んでいなかった。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が devex-api・devex-ui 本体へ実装し、`textbook/samples/` も同じ内容で作る)。

E2E: この Phase では流さない。パネルは superuser でレビューがオンのときだけ出て、E2E のユーザーはどちらでもない。オフの画面に足したのは `GET /users/me` の呼び出しだけ。ステージ8の E2E は Phase 59 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 53 開始時」を参照。すべて推奨どおり。

1. **自動実装モード**: on。
2. **パネルの置き場と飛ぶ仕組み**: `features/design-review` に共通のパネルを作り、プレビュー(タブの上)と作業領域(変更の影響のパネルの下)に置く。作業領域は既存の `jumpTo` で対象の段階・行へ飛ぶ。プレビューは対象を載せている文書のタブへ切り替えるだけ。
3. **superuser の切り替えの置き場**: パネルの中(見出しのスイッチ)。一般ユーザーにはパネルを出さない。
4. **プロンプトキャッシュ**: 入れない。回にキャッシュのトークンを記録し続け、Phase 58 の測定で決める。

Claude の判断(計画の承認で確定、または作業中):

- **未レビューの判定は版で結ぶ**。段階の区切りの回の `targets` は `{doc_type: 版, "stage:N": 承認した版}`。写しのハッシュは使わない([53-1](./Phase-53-1.md))。
- **区切りの「そろった」**: documents = 文書がそろっている、stage6 = 段階1〜6 が承認済み(古くない)、stage7 = 段階1〜7。文書を作り直すと段階が「古い」になるので、段階の区切りは承認し直すまで「文書がまだ無い」になる。
- **段階の区切りの入力**: 要件・外部の表示中の版 + 詳細設計書(段階6 は01〜06章、段階7 は01〜07章 + 実装計画書)。段階の検証の指摘も既知として渡す。
- **チャットは一行**: 指摘の md(`render_findings`)は残し、チャットには `render_notice` を出す(Phase 52 の申し送り)。
- **マイグレーションは無い**: `gate` は文字列、採否の列は Phase 52 で作ってあった。
- **生成の直後の取り直し**: 生成を「完了」にしてから自動のレビューを受け付けるので、完了の直後は回がまだ無いことがある。パネルは文書・段階の版が変わったら3回(5秒ごと)取り直す([53-4](./Phase-53-4.md))。
- **承認のダイアログの説明は段落**なので、ボタンは文の中に置いた(ブロック要素を入れない。[53-5](./Phase-53-5.md))。
- 計画では対象の部品を `FindingTargets.tsx` としていたが、採否も含めた指摘の表 `FindingTable.tsx` にまとめた。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-53-1.md`](./Phase-53-1.md) | 区切りとレビューの入力(devex-api) | あり | なし |
| [`Phase-53-2.md`](./Phase-53-2.md) | 区切りの一覧と採否の API(devex-api) | あり | 53-1 |
| [`Phase-53-3.md`](./Phase-53-3.md) | 画面の API・意味モデル・ストア(devex-ui) | あり | 53-2 |
| [`Phase-53-4.md`](./Phase-53-4.md) | レビューのパネルと、対象へ飛ぶ仕組み(devex-ui) | あり | 53-3 |
| [`Phase-53-5.md`](./Phase-53-5.md) | 段階6・7 のボタンと手順書の知らせ(devex-ui) | あり | 53-3・53-4 |

## サンプルコード一覧

- `textbook/samples/backend/`: 新規 `app/review/gates.py`・`tests/unit/test_review_gates.py`。更新 `app/review/__init__.py`・`prompt.py`・`render.py`・`app/services/errors.py`・`app/repositories/review.py`・`app/services/review_service.py`・`app/services/doc_generator_service.py`・`app/schemas/review.py`・`app/api/routes/reviews.py`・`tests/unit/test_review_service.py`・`test_review_routes.py`
- `textbook/samples/frontend/`: 新規 `src/features/design-review/` の `api/reviewApi.ts`・`model.ts`・`review-store.ts`・`components/FindingTable.tsx`・`components/ReviewPanel.tsx`・`test-utils/reviewFixtures.ts` とそのテスト。更新 `src/features/detailed-design/impactOps.ts`・`components/DetailedDesignPageContent.tsx`・`components/ProcedureDocPanel.tsx`・`src/features/documents/components/DocumentTabs.tsx`・`DocumentsPageContent.tsx` とそのテスト

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [53-1](./Phase-53-1.md) | `app/review/gates.py`・`review_service.py` | 区切りの定義・状態・版、段階の区切りの入力、採否の記録 | 状態の真理値表・版の組み立て・段階の検証の読み替え・知らせの文(`test_review_gates.py`)/ 簡易・未承認は409・段階6・7の入力の章・承認し直すと未レビュー・採否は自分のプロジェクトだけ(`test_review_service.py`) |
| [53-2](./Phase-53-2.md) | `app/schemas/review.py`・`app/api/routes/reviews.py` | `GET /reviews`・`PUT /reviews/findings/{id}` と、`{gate}` の3つ | 実行中と `is_current`・段階6の受け付け・採否と404(`test_review_routes.py`) |
| [53-3](./Phase-53-3.md) | `reviewApi.ts`・`model.ts`・`review-store.ts` | API の型と呼び出し・ラベルと純粋関数・区切りとユーザーの状態 | URL とメソッド・順序・知らせ・対象 → 文書・プロジェクトの切り替え・失敗の文・採否の置き換え |
| [53-4](./Phase-53-4.md) | `ReviewPanel.tsx`・`FindingTable.tsx`・`impactOps.ts`・両画面 | パネル・指摘の表・対象 → 段階・タブ / 段階への移動 | 一般ユーザーは出ない・オフは切り替えだけ・区切りの操作・順序と採否・飛べる対象・古い版の注記・タブの切り替え・`jumpTo` |
| [53-5](./Phase-53-5.md) | `DetailedDesignPageContent.tsx`・`ProcedureDocPanel.tsx` | 承認のダイアログのレビュー・手順書の生成のときの知らせ | オンなら段階6の区切りを流す・オフなら出さない・未レビューなら知らせて止めない |

## 写経順序(#23)

章番号順。各章の「この章で作成・更新したファイル」の表の順に写す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 53-1: `app/review/gates.py` は `app.detailed_design.stages.stage_key`・`app.detailed_design.validation`(`Severity`・`StageIssue`)・`app.documents.issues`(`DocumentIssue`・`IssueLevel`)を読む(以前の Phase)。`prompt.py` は同じ章の `gates` と `app.detailed_design.stages`(`STAGES`・`stage_key`)。`review_service.py` は `app.detailed_design.document`・`plan.PLAN_STAGE`・`validation.validate_stage`・`DesignStageRepository`・`DesignStageService`・`DetailedDesignExportService`(以前の Phase)と、同じ章の `app.review` の区切り・`ReviewFindingNotFoundError`。53-1 の時点の `app/api/routes/reviews.py` は `start_review`・`latest`・`targets_for`(同じ章)を呼ぶ(53-1 のタグ)。
- 53-2: `app/schemas/review.py` は `app.review`(`GateStatus`・`ReviewGate`。53-1)、`reviews.py` は `GateSummary`(53-1)を読む。
- 53-3: `model.ts` は `DocType`(`documents/api/documentsApi`。以前の Phase)と同じ章の `reviewApi` の型。`review-store.ts` は `@/lib/api/cache`・`types` と同じ章の `reviewApi`。
- 53-4: `ReviewPanel.tsx` は `tableStyles`・`useInterval`(以前の Phase)と、`FindingTable`・`model` の `TargetActionOf`(同じ章)・`review-store`(53-3)。`DetailedDesignPageContent.tsx` の 53-4 の分は `locateTargetStage`(同じ章)。
- 53-5: `ProcedureDocPanel.tsx` は `unreviewedNotice`・`useReviewStore`(53-3)、`DetailedDesignPageContent.tsx` の 53-5 の分は `ReviewGate`・`GATE_LABEL`・`useReviewStore`(53-3)。
- 前方 import は無い。章が作成・更新するファイルは、その章のテストが少なくとも1度 import する(`errors.py`・`repositories/review.py`・`doc_generator_service.py` は `test_review_service.py`、`render.py`・`prompt.py` は `test_review_gates.py`、`FindingTable.tsx` は `ReviewPanel.tsx` を通る、`test-utils/reviewFixtures.ts` は 53-3 のテスト)。

## 検証結果

- 章ごとの部分テスト: 53-1 `test_review_gates.py` 14件・`test_review_service.py` 18件、53-2 `test_review_routes.py` 8件、53-3 12件、53-4 ・53-5 は ReviewPanel 6件と、`impactOps`・両画面・手順書のパネルのテストに足した 8件、すべて成功。
- Phase 完了時の全体テスト(#18): devex-api 1128 件成功(8件は既定で除外の統合テスト。Phase 52 の 1105 + 23)。devex-ui 818 件のうち、並列で流したときに 5 秒のタイムアウトが 4件(`RegisterForm`・`ProcedurePanel`・`IntakeForm` ×2。この Phase で触っていないファイル)。3ファイルを単独で流すと 22件すべて成功(Phase 44 からの申し送り「並列のテストのタイムアウト」と同じ)。
- `ruff check` 成功(`ruff format` は使わない)。変えた Python のファイルに pyright: エラー 0。`tsc --noEmit` 成功、`npm run lint` はエラー 0(警告1件は既存の `streamChat.test.ts`)。
- マイグレーション: 無し。
- 実 LLM(Claude Sonnet 5.5。dev のサーバーに本物の API で。題材はステージ7の効果測定のプロジェクト(detailed-3・simple-2 の実物)。持ち主を一時的に superuser・オンにし、確認の後で戻した):

  | 回 | 入力 / 出力トークン | 時間 | 指摘 | 費用 |
  |---|---|---|---|---|
  | 詳細・段階6(ボタン) | 31,456 / 6,508 | 56秒 | 14件(最重要 4) | 約 $0.13 |
  | 詳細・段階7(ボタン) | 35,059 / 7,881 | 61秒 | 15件(最重要 2) | 約 $0.15 |
  | 詳細・文書(もう一度レビュー) | 10,686 / 3,595 | (測っていない) | 12件(最重要 2) | 約 $0.06 |
  | 簡易・4文書(実 Gemini で作り直した後の自動) | 16,516 / 7,576 | 生成 約30秒 + 約60秒 | 14件 | 約 $0.11 |

  - 計 約 $0.44(計画の見込み $0.6 の内)。入力は見込みどおり、出力は見込み(段階 6〜10k)の範囲。
  - 段階6 は「projects に持ち主の列が無い・本人のものか確かめない」(DD の最重要)と、ヒアリングが原因のセキュリティ・不正利用の指摘(観点のキー付き)を当てた。段階7 は実装計画の網羅(画面・デプロイのタスクが無い)も指摘した。
  - チャットはどの回も件数の一行。簡易の自動のレビューは、生成の完了の約30秒後に「実行中」が見え、約60秒で「レビュー済み」(`trigger=auto`・`is_current=true`)。オンのときに自己診断が出ていないこと、採否の `PUT`(他のプロジェクトの指摘は404、知らない値は422)も確かめた。
  - 詳細のプロジェクトは、文書を作り直した後で段階がすべて「古い」だったため、段階の区切りは「文書がまだ無い」と出た(設計どおり)。変更の影響の印を確認済みにして段階1〜7 を承認し直してから流した。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 607 / 並び順のみ差 8 / 例外 5)。「samples のみ」2件は Phase 51 から続く `change-impact-demo` のルート。`link_check.py`: 切れ 0 件。

## 完了後の調整

**簡易モードの再生成が「完了しない」**(ユーザーの画面確認、2026-10-14)。レビューの後に「再生成」を押すと終わらず、その間にもう一度押すと「設計書を生成しています…」(409)が出た。

- **事実**: dev のログでは、再生成は始まっていて、Gemini が 503・504(DEADLINE_EXCEEDED)とタイムアウトを返し続け、約14分半後に失敗して「完了」(古い版のまま)に戻っていた。その間の `projects.status` は正しく `generating` で、409 は正しい応答だった。レビューは流れていない(Phase 53 の変更が原因ではない)。
- **原因1(サーバー)**: `ChatGoogleGenerativeAI` の `max_retries`(既定 6)。SDK(google-genai)が中で再試行を重ね、その外側で `invoke_with_retry` が3回試すので、1回の呼び出しが 30 秒のタイムアウトを超えて数分かかった。`get_gemini_llm()` に `max_retries=1` を渡して SDK の再試行を止めた(`0` は「Google の既定 = 5回」の意味。Context7 のドキュメントで確かめた)。再試行は `invoke_with_retry` だけになる(Claude の側は Phase 52 で `max_retries=0`)。
- **原因2(画面)**: プレビューの「再生成中」はストアの中の印だけで、待つ時間の上限(3分)を過ぎるとポーリングが止まって「再生成中...」のまま残り、読み込み直すと生成中だと分からずにボタンが押せた。直したこと: プロジェクトの `status` が `generating` なら再生成中として扱う(ボタンを押せなくし、完了を待ち直す)・409 `DOC_GENERATION_IN_PROGRESS` は失敗にせず完了を待つ・3分を過ぎたら「時間がかかっています。読み込み直してください(生成中なら続きを待ちます)」を出す(チャット画面と同じ扱い)。
- **変えたファイル**: `app/ai/llm/gemini.py`・`tests/unit/test_gemini.py`・[`documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts)・[`DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) とそのテスト(タグは `Phase-53(完了後の調整)`)。
- **再報告(修正の後も通らない)**: 修正の後の再生成(01:49・01:53)は、約1分で 504 DEADLINE_EXCEEDED で失敗して「完了」に戻った(前は約14分半)。入力は初回の生成(1回 2〜6 秒で通った)と同じだった。google-genai はタイムアウト(30秒)を `X-Server-Timeout` としてサーバーへ送るので、30秒を超える応答は Gemini 側で 504 になる。「こんにちは」とだけ返させる最小の呼び出しも約28秒で 504 だったので、Gemini(gemini-3.5-flash-lite)の障害と判断した。ユーザーの決定で、コードは変えずに復旧を待つ。
- **テスト**: `test_gemini.py` に `max_retries == 1`、`documents-store.test.ts` に「生成中なら再生成中」「409 の生成中は失敗にしない」(409 を失敗の文として扱っていた既存のテストは 500 に替えた)、`DocumentsPageContent.test.tsx` に「上限を過ぎたら読み込み直しを促す」。部分テストは devex-api 18件・devex-ui の `src/features/documents` 58件が成功、`tsc`・lint・ruff・pyright もエラー 0。dev のコンテナで `max_retries=1`・`timeout=30` を確かめた。Gemini の障害は再現できないので、本物の再生成は Gemini が戻ってから確かめる(下の申し送り)。

**再生成の起点と進み具合・レビューの指摘の関連文書**(ユーザーの画面確認からの UI の調整、2026-10-14)。依頼は2つ: プレビューの再生成で対象を選べるようにし、生成中も文書ごとの状態を出す / レビューのパネルの指摘の表を開閉できるようにし、指摘ごとに関連する文書を凡例の文字で出す(どの文書を作り直せばよいか分かるように)。着手時の相談(すべてユーザーの決定。経緯は [`q_a.md`](../q_a.md)「Phase 53 完了後 ── 再生成の起点・進み具合・指摘の関連文書」):

- **再生成は起点で選ぶ**: 「上流を作り直すと下流に必ず影響があると言い切れるか」というユーザーの問いに、「中身が必ず変わるとは言えないが、下流は上流を入力にして作るので整合は保証できなくなる。今の再生成も上流の変わった行を下流に渡して差分にとどめる作り」と答え、文書を個別に選ぶ代わりに「どこから作り直すか」を選ぶことにした(要件定義から / 外部設計以降 / 内部設計以降 / 実装計画だけ。実装計画は内部設計を入力にするので、内部設計からは実装計画も作り直す)。
- **関連文書は Sonnet が返す**: 構造化出力に `documents`(直すときに書き換える文書)を足した(必須の欄・知らない値は捨てる・上流から並べる)。`review_findings.documents`(JSON、null 可。Alembic `a7b8c9d0e1f2`)。列を足す前の指摘は、画面が対象の書き方から推定して薄く出す。
- **進み具合は Redis**: 生成の間だけ `doc_generation:{project_id}` に `{targets, done, current}` を置き、終わったら(成功・失敗とも)消す。保存は今どおり最後にまとめて行う(失敗したら全部取り消す)。
- **記録は Phase 53 の完了後の調整**(samples のタグ `Phase-53(完了後の調整)`)。

作ったもの:

- devex-api: `generation_targets(mode, start_from)`(起点から下流)・`request_generation(..., start_from)`(モードに無い起点は 400 `GENERATION_START_INVALID`、上流が無ければ 409 `GENERATION_UPSTREAM_MISSING`)・`generate(..., start_from)`(起点より上流は表示中の版を下流の入力にする)・`app/services/generation_progress.py`・`POST /projects/{id}/generate` の本文 `{start_from}`・`GET /projects/{id}/generation-progress`。レビュー: `ReviewFindingOut.documents`・指示に「documents には直すときに書き換える文書を入れる(モジュール・API パスなら要件定義を入れない)」・`only_reviewed_documents`(その回に渡した文書だけに絞る)。
- devex-ui: 再生成のダイアログで起点を選ぶ(選んだ起点で作り直す文書を括弧で示す)・再生成中の進み具合「要件定義：生成完了 外部設計：生成中 内部設計：待ち 実装計画：対象外」(`regenerationOps.ts`)・レビューのパネルの区切りごとの開閉(初めは閉じる)・指摘の表の「文書」の列と凡例(`DOCUMENT_LETTER`・`documentLegend`・`findingDocuments`)。
- docs: [`external_design.md`](../../docs/external_design.md)(SCR-005 の再生成・2.11 の画面)、[`internal_design.md`](../../docs/internal_design.md)(API・指摘の関連文書)。

検証:

- テスト: devex-api 1138 件成功(`test_doc_generation_start.py` 6件・レビューのテストに追加)、マイグレーションの往復と `alembic check`。devex-ui 830 件中 829 件成功(残り1件は既存の並列のタイムアウトで、単独では成功)。`ruff check`・pyright・`tsc`・lint はエラー 0。
- 実 Sonnet(計 約 $0.27): 簡易の文書の区切り(46秒・11件・約 $0.07)── モジュールが対象の指摘は内部設計だけ、要件が欠けている指摘にだけ要件定義が入った。詳細の段階6(56秒・13件・約 $0.135)── 詳細設計モードに無い内部設計書を挙げた指摘があったので、その回に渡した文書だけに絞る処理を足した(この回の保存は絞る前)。「外部設計以降」の再生成(Gemini 13秒。進み具合が 外部設計 → 内部設計 → 実装計画 と変わり、要件定義は v1 のまま、ほかは v2)の後の自動のレビュー(9件すべてに関連文書・約 $0.06)。
- **確認用のデータ(ユーザーの指示で消さずに残した)**: アカウント `example-super-user@example.com`。簡易 `33fdda56…`(レビュー済み・外部設計以降を再生成した)。詳細は、ステージ7の効果測定の詳細 `86a37228…` を複製した `06f93618…`(題名の末尾に「(確認用の複製)」。段階1〜7 承認済み・段階6 をレビュー済み)。複製は使い捨てのスクリプトで行い、本体には入れていない。

**各段階の表の AI レビューの指摘のバッジ**(ユーザーの依頼、2026-10-14)。詳細設計の作業領域で、指摘の対象になっている項目を各段階の表でバッジとして見せ、押すと「問題と根拠」「改善案」「判断」をダイアログで出して採用・却下・保留を選べるようにする。却下した指摘はバッジにしない。

- **結び方**: 指摘の対象の文字列ごとに、段階1〜8 それぞれで `resolveFixTarget`(「段階Nで直す」と同じ推定)が返す要素のキーに結ぶ(`src/features/detailed-design/reviewMarks.ts` の `reviewFindingsByKey`)。1つの対象が複数の段階に当たれば(F-03 は段階1の処理・段階5の手順など)、それぞれの段階の行に出す。要件 ID・画面など段階に無い対象はバッジにしない(レビューのパネルには出る)。区切りごとの最新の成功した回の指摘を使い、レビューがオンのアカウントだけに出す。
- **置き場**: 各段階の表が変更の影響の印(`ImpactBadge`)を出している10か所に、同じ要素のキーで `ReviewFindingBadge` を並べた(`useStageReview(stage)` がその段階の `findings(key)` を作る)。表の作りは変えていない。
- **ダイアログ**: その行の指摘を重要度の順に、重要度・原因・どの区切りのレビューか(段階・文書が変わる前のレビューなら注記)・問題と根拠(問題・引用・理由)・改善案・判断を出す。判断はレビューのストアの `decide`(パネルと同じ記録。押し直すと未判断)。却下するとその場で外れ、残りが無くなればダイアログごと消える。
- 作ったもの: `reviewMarks.ts`・`hooks/useStageReview.ts`・`design-review/components/ReviewFindingBadge.tsx` と、表の部品9ファイル(FunctionListPanel・DataFlowPanel・TableDefinitionTable・CrudMatrix・ModuleListTable・ProcedurePanel・LogicPanel・PlanTables・ProcedureDocPanel)。サーバーは変えていない。実 LLM の費用は無し。
- テスト: `reviewMarks.test.ts`(段階ごとの結び付け・却下を除く・重要度の順・成功していない回)・`ReviewFindingBadge.test.tsx`(件数・ダイアログの中身・採否・指摘が無くなったら消える)・`FunctionListPanel.test.tsx`(行にバッジが出る)。devex-ui 全体は 837 件中 834 件成功(残り3件は既存の並列のタイムアウトで、単独では成功)。`tsc`・lint はエラー 0、samples は不一致 0。
- 画面の確認: 確認用のデータの詳細(`06f93618…`。段階6 をレビュー済み)で、段階1・3・4・5・6 の表の行にバッジが出るはず(段階6 の指摘の対象に F-xx・テーブル名・モジュールのパスがある)。

## 未消化の申し送り(#37)

Phase 52 から引き継いだもの:

- **Phase 54〜59 の未確定事項**: [51-5](../Phase-51/Phase-51-5.md)「未確定事項」(Phase 53 の分はこの Phase で決めた)。
- **「AI に提案を求める」・判定がログインの方法だけでセキュリティを埋めた・初期入力だけで MVP の範囲が対象外になった**: Phase 54 の差し戻しと再ヒアリングで拾い、Phase 58 で確かめる。この Phase の採否の記録(`decision`)を Phase 54 が読む。
- **ヒアリングの判定の見直し**(公開サービスでセキュリティが浅いまま採用されたとき、アクセス制御を聞き直す): Phase 54。
- **Judge(狭い判定のモデル)の使い道**・`get_judge_llm()`: Phase 54。
- **テスト仕様書の中身の正しさ**・**実装手順書に固有の欠陥**: Phase 55・56・58。
- **プロンプトキャッシュ**: 入れていない(着手時の決定4)。回のキャッシュのトークンを Phase 58 の測定で見て決める。段階の区切りは入力 31〜35k トークン。
- **本番の手順**: `ANTHROPIC_API_KEY` の設定と superuser の昇格、`langchain-anthropic` の追加でイメージの作り直し(Phase 59 の `OPERATIONS.md`)。
- **依存の更新**: `langchain-anthropic` の追加で `langchain-core` が 1.6.10 に上がった(Phase 52)。
- **生成のモデルと Gemini の無料枠**(51-1 の (f)): ステージ8の範囲の外。
- **devex-ui の「開発用」メニュー**: ステージ8の完了時に、ユーザーが外すかを決める。
- 持ち越し: **DFD のデータストアの書き漏れ**(49-2 から)・**補いの文字の当たり**(Phase 48 から)・**画面の文の変更は、その画面のすべての処理へ届く**(49-4 から)・**改名の後に下流の参照を直して承認すると広がる**(Phase 43 から)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase の全体テストでも 4件出た)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。

この Phase で生まれたもの:

- **画面の操作感の確認**(ユーザー、Phase の直後。51-5 のとおり新しい種類の画面のため): seed の superuser(`example-super-user@example.com`)でログインし、パネルのスイッチをオンにして、簡易のプロジェクトで生成 → パネルの区切りの表・指摘の表・採否・対象から飛ぶ、詳細のプロジェクトで段階6・7 の承認 → ダイアログの「AI 設計レビューをする」・手順書の生成の知らせを見る。費用は1回 $0.06〜0.15。見たいところ: 指摘が多い(区切りごとに 12〜15件 × 3)ときのパネルの長さ(折りたたむか)、対象の推定の当たり(LLM の対象は「projects」「F-03」「2.6 API一覧」のように書き方がまちまちで、飛べるのは一部)。
- **dev の DB で変えたもの**: 確認に使ったステージ7の効果測定のプロジェクトのうち、詳細(`86a37228…`)は変更の影響の印を確認済みにして段階1〜7 を承認し直し、簡易(`9305529c…`)は4文書を作り直した(段階8 は「古い」になった)。持ち主の superuser・オンは戻した。
- **段階の区切りと「古い」**: 文書を作り直すと段階の区切りは承認し直すまでそろわない。Phase 54 の差し戻し(再生成)の後に、段階の区切りのレビューがどこで流れ直すか(承認し直した後のボタン)を決める。
- **セッションの区切りの記録**: Phase 53 は1セッションで行った(計画モードで調査 → 着手時の質問1回(4問)→ 計画の承認 → 53-1〜53-5 の実装とテスト → 全体テスト → 実 LLM の確認 → samples → 教材)。

- **再生成の失敗を画面で知らせていない**(完了後の調整で見つけた): 生成が失敗しても状態は「完了」に戻るだけで、プレビューには古い版がそのまま出て、失敗の知らせが無い。今回は直していない。
- **完了後の調整の画面確認**(ユーザー): 上の「確認用のデータ」でブラウザから見る。再生成のダイアログ・進み具合・パネルの開閉・文書の列・各段階の表の指摘のバッジとダイアログ。
- **採用した指摘の追跡(採用したのに直していない指摘を見つける)**(完了後のユーザーの依頼。提案を記録し、Phase 54 に組み込む ── ユーザーの決定): 安いものから3段で判定する。L0 版 = 採用した指摘の関連文書(A〜D。詳細設計書は段階1〜6、実装計画(詳細)は段階7)の版が、レビューしたとき(`review_runs.targets`)から変わっていなければ「未対応」。L1 行 = 版は変わったが、指摘の対象の行(`changed_rows`。レビューした版が直近3版の外に消えていたら L0 に戻す。段階は承認したときの写し)が変わっていなければ「対象が変わっていない」。L2 意味 = 対象が変わったものだけ、Haiku の「直ったか」(Phase 54 の計画どおりシャドーモードから)。L0・L1 は決定的で費用なし(`app/review/followup.py` の純粋関数・`ReviewFindingRead.followup`、DB の列は足さない)。見せ方: パネルの判断の列のチップ(未対応 赤・対象が変わっていない 橙・変更あり 灰)と見出しの「採用 n(未対応 m)」・各段階の表のバッジの強調・手順書の生成と段階6・7 の承認での知らせ(止めない)・未対応の指摘の最も上流の関連文書を再生成の起点の初期値に。Phase 54 の最初の章で L0・L1 を作り、L2 を載せる。
- **採用した指摘から再生成の起点を出す**: 指摘の関連文書のうち最も上流を、再生成の起点の候補にする(差し戻しの Phase 54 で検討)。

この Phase で解決したもの:

- **再生成の本物の確認**(完了後の調整から): 「外部設計以降」の再生成が完了した(上の「完了後の調整」)。

- **チャットの指摘の md を縮める**(Phase 52 から): [53-1](./Phase-53-1.md) の `render_notice`。
- **生成からの通しの確認(実 Gemini + 実 Claude)**(Phase 52 から): 上の検証結果(API で確かめた。画面の確認は上の「画面の操作感の確認」)。
- **プロンプトキャッシュを Phase 53 で入れるか**(Phase 52 から): 入れない(着手時の決定4。測定は Phase 58 へ)。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 段階の区切りの「未レビュー」を、承認した版(`approved_version`)で決めるのはなぜか。文書を作り直したとき、段階の区切りがどう見えるかを説明できるか。
2. 段階6 の区切りに詳細設計書の 07章(横断事項)を渡さないのはなぜか。段階7 の下書きの入力との関係は。
3. 生成の完了の直後にパネルを取り直し続けるのはなぜか。どの順で「完了」と回の受け付けが起きるか。
4. 作業領域とプレビューで「対象へ飛ぶ」の作りを変えたのはなぜか。パネルの部品が両画面の事情を知らずに済むのは、何を渡しているからか。
5. 手順書の生成のときの知らせを「止めない」にしたのはなぜか(51-2 の決定2)。

## 次のフェーズ

**Phase 54**: 差し戻し(採用した設計・不整合の指摘から再生成の指示・採用したヒアリングの指摘で観点を未決に戻して聞き直す・再生成の後に同じ区切りで流れ直す・「直ったか」の判定のシャドーモード)。着手時に [51-5](../Phase-51/Phase-51-5.md) の Phase 54 の未確定事項と、この節の「段階の区切りと『古い』」を決める。
