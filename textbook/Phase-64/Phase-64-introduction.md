# Phase 64 導入: プロジェクトの削除(ステージ9)

## 目的

ステージ9の3つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 64 として、ダッシュボード・文書の画面(SCR-005)・詳細設計の画面(SCR-008)からプロジェクトを削除できるようにする。[Phase 61](../Phase-61/Phase-61-1.md) の決定3で、**生成中でも削除できる**ことにした(推奨は 409 で断ることだった)。そのため、バックグラウンドの処理が、途中でプロジェクトが消えても壊れないようにする。

- 削除の API を作る(削除の印・取得から外す・物理削除・Redis の進み具合)── [64-1](./Phase-64-1.md)
- 4つのバックグラウンドの処理を、プロジェクトの消失に強くする ── [64-2](./Phase-64-2.md)
- 削除の確認とトーストの部品を作る ── [64-3](./Phase-64-3.md)
- ダッシュボードのカードと2つの画面に置く ── [64-4](./Phase-64-4.md)

## パイプライン上の位置づけ・前提

```
ダッシュボードのカード(ゴミ箱)─┐
文書の画面の「削除」──────────┼─[64-3 DeleteProjectButton: アラートダイアログ → DELETE → 一覧から外す → トースト]
詳細設計の画面の「削除」────────┘                       │(文書・詳細設計の画面は /dashboard へ)
                                                        ▼
DELETE /projects/{id} ─[64-1 削除の印(deleted_at)を付けて 204]─ BackgroundTask: 物理削除(SKIP LOCKED)
                                                        │
生成中のジョブ(文書・段階・レビュー・判定)─[64-2 入口・失敗の記録の前・commit で消失を確かめる]
                                                        └─ 終わりに物理削除をもう一度試す
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 64 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節「プロジェクトの削除」、[内部設計書](../../docs/internal_design.md) 3.3節 9項「プロジェクトの削除」。
- **今の仕組み**: プロジェクトの子のテーブル(9つ)と孫(`review_findings`・`review_fix_checks`)は、外部キーの `ondelete="CASCADE"` を持つ。バックグラウンドの処理は FastAPI の `BackgroundTasks` で動き、4つの入口(`generate_documents`・`execute_review`・`run_fix_checks`・`run_design_stage_generation`)がセッションを自前で開く。
- **調べて分かったこと(方式を決めた理由)**: 文書の生成(4文書とテスト仕様書)、段階2〜4の生成、「直ったか」の判定は、最初の子の行を書いた後も、同じトランザクションのまま LLM を呼び続ける。Postgres は、子の行を書いたトランザクションに親の行の FOR KEY SHARE のロックを持たせる。そのため、物理的な `DELETE FROM projects` はジョブが終わるまで(数分)待たされる([64-1](./Phase-64-1.md))。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `a8a1c01`、devex-ui は `589a083`(Phase 63)。外側のリポジトリは Phase 63 までコミット済み(`096f61e`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。`e2e/helpers.ts` はダッシュボードのカードに触れないので、カードの組み直しで壊れない。画面の流れは、Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 64 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on |
| 2 | 生成中のプロジェクトを削除する方式 | **削除の印 → 後で物理削除**(推奨どおり)。あわせて、**削除が終わったことを Tamagui の Toast で知らせる**(ユーザーの追加の要望) |
| 3 | ダッシュボードの削除ボタンの見た目 | **ゴミ箱のアイコンだけ**(推奨は文字の「削除」。推奨と違う)。**削除する前にアラートダイアログで確かめる** |
| 4 | (計画の差し戻しで追加)確認の範囲 | **アラートダイアログでの確認は、削除の処理に共通する**。どの画面から削除しても、確認を通らずに API を呼ぶ経路を作らない |

Claude の判断(計画の承認で確定、または作業中):

- 削除の要求で消すものは、Redis の進み具合の鍵(`doc_generation:{id}`)だけにした。「直ったか」の予約札(`fix_check:*`)は指摘の単位で、10分で切れるので触らない。
- 削除した後に動いていた処理の記録は、ログ(`project_deleted_during_job`)だけにした([61-3](../Phase-61/Phase-61-3.md) の未確定事項)。
- 消失への強さを作る共通の部品は `project_vanished`・`commit_if_live`(`app/services/project_deletion.py`)にした。処理の入口の確認と、途中の例外の読み替えを1か所に集める([61-3](../Phase-61/Phase-61-3.md) の未確定事項)。
- 確認の文言は「プロジェクトを削除しますか」とし、本文で消えるもの・戻せないこと・生成中の処理が止まることを書いた([61-3](../Phase-61/Phase-61-3.md) の未確定事項)。
- 文書と詳細設計の画面のボタンは、文字の「削除」にした(「再生成する」と揃える。ユーザーはダッシュボードだけを指定した)。
- **作業中**: トーストは、計画では `@tamagui/toast/v2` の `Toaster` だった。ブラウザで確かめると、tamagui 2.6.0 の web で `accessibilityLabel` を DOM に渡し、React の警告(開発用の表示の「1 Issue」)が毎回出た。そこで同じパッケージの従来の API(`ToastProvider`・`ToastViewport`・`useToastController`)に替えた([64-3](./Phase-64-3.md))。
- **作業中**: `@tamagui/toast` を `^2.6.0` で入れると 2.7.7 になり、別の版の Tamagui の部品を大量に引き込んだ。そこで tamagui 本体と同じ `2.6.0` に固定した(package-lock の変更は1行)。
- **作業中**: 詳細設計の画面はプロジェクトの名前を読み込まないので、`DeleteProjectButton` の `title` を省略可能にし、省いたときは「このプロジェクト」と書く。文書の画面は、すでに `getProject` を呼んでいるストアに名前を持たせた([64-3](./Phase-64-3.md)・[64-4](./Phase-64-4.md))。
- **作業中**: integration のテストのファイル名がユニットのテストとぶつかった(テストのフォルダに `__init__.py` が無い)ので、`test_project_delete_flow.py` にした。利用者は API で登録せず DB に直接作る(スイート全体で登録の IP ごとの上限を超えたため)([64-1](./Phase-64-1.md))。

推奨と違った選択は1つ(ダッシュボードのアイコン)。ユーザーの追加の要望は2つ(トーストで知らせること・確認を削除の処理に共通にすること)。計画は1回差し戻された(確認の共通化を計画に明記した)。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-64-1.md`](./Phase-64-1.md) | 削除の API(削除の印・物理削除) | あり(本体 6 + テスト 2) | なし |
| [`Phase-64-2.md`](./Phase-64-2.md) | バックグラウンドの処理の消失への強さ | あり(本体 6 + テスト 2) | 64-1(`project_vanished`・`purge_deleted_projects`) |
| [`Phase-64-3.md`](./Phase-64-3.md) | 削除の確認とトースト(UI の部品) | あり(本体 5 + テスト 5) | 64-1(`DELETE /projects/{id}`) |
| [`Phase-64-4.md`](./Phase-64-4.md) | 画面への配置 | あり(本体 4 + テスト 4) | 64-3(`DeleteProjectButton`) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新:

- 64-1: `alembic/versions/8d4f1a2b6c3e_add_deleted_at_to_projects.py`(新規)・`app/models/project.py`・`app/repositories/project.py`・`app/services/project_deletion.py`(新規)・`app/services/project.py`・`app/api/routes/projects.py`・`tests/unit/test_project_delete.py`(新規)・`tests/integration/test_project_delete_flow.py`(新規)
- 64-2: `app/services/project_deletion.py`(`commit_if_live` を追記)・`app/services/doc_generator_service.py`・`app/services/review_service.py`・`app/api/routes/reviews.py`・`app/services/fix_check_service.py`・`app/services/design_stage_generation_service.py`・`tests/fixtures/vanishing_llm.py`(新規)・`tests/unit/test_job_project_vanish.py`(新規)
- 64-3: `src/features/dashboard/api/projects.ts`・`src/features/dashboard/dashboard-store.ts`・`src/components/layout/AppToast.tsx`(新規)・`src/app/providers.tsx`(テンプレート由来。samples に新規)・`src/features/dashboard/components/DeleteProjectButton.tsx`(新規)・`package.json` とテスト5つ
- 64-4: `src/features/documents/documents-store.ts`・`src/features/dashboard/components/ProjectListItem.tsx`・`src/features/documents/components/DocumentsPageContent.tsx`・`src/features/detailed-design/components/DetailedDesignPageContent.tsx` とテスト4つ
- ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [64-1](./Phase-64-1.md) | `projects.deleted_at`・`ProjectRepository`・`project_deletion.py`・`ProjectService.delete`・`DELETE /projects/{id}` | 印を付けてすぐ返す / 印の付いた行を取得から外す / ロックの取れる行だけ物理削除する | 印の付いた行は取得・一覧に出ない・進み具合の鍵が消える・204 と物理削除の予約・他人は404・(Postgres)子の行が CASCADE で消える・ロック中でも DELETE は待たない・子の行のロックで物理削除を後に回す |
| [64-2](./Phase-64-2.md) | `commit_if_live`・4つのジョブ | 入口・失敗の記録の前・commit で消失を確かめ、何も記録せずに終える | 途中で消えたら成功も失敗も記録しない(文書・レビュー・判定・段階)・入口で印があれば何もしない・生きているプロジェクトの例外はそのまま上げる |
| [64-3](./Phase-64-3.md) | `deleteProject`・`removeProject`・`DeleteProjectButton`・`AppToastProvider` | 確認 → API → 一覧から外す → トーストを1つの部品に集める | 押すとダイアログが開き API を呼ばない・削除できたら外してトースト・404 も成功・失敗はダイアログの中・名前の無い文言・トーストが画面に出る |
| [64-4](./Phase-64-4.md) | `ProjectListItem`・2つの画面・`documents-store` | リンクとボタンを兄弟にする / 並びの右端に置き、削除したら `/dashboard` | ボタンはリンクの外・3か所とも確認を通る・削除したら `/dashboard`・ストアが名前を持つ |

## 写経順序(#23)

章番号順(64-1 → 64-2 → 64-3 → 64-4)。各章の表の順(依存順。#30)に写す。64-1 のマイグレーションを当ててから(`alembic upgrade head`)、64-1 のテストを流す。

実 import 監査(#15。全 import 文を読んで確かめた):

- 64-1: `project_deletion.py` → `sqlalchemy`・`app.core.database.AsyncSessionLocal`・`app.repositories.project.ProjectRepository`(既存。`is_live`・`purge_deleted` は 64-1)。`services/project.py` → `redis.asyncio.Redis`・`GenerationProgressStore`(既存)。`routes/projects.py` → `purge_deleted_projects`(64-1)。
- 64-2: `commit_if_live` は 64-2 で `project_deletion.py` に追記し、`collections.abc` を足した。4つのジョブ → `commit_if_live`(64-2)・`project_vanished`・`purge_deleted_projects`・`VANISHED_ERRORS`(64-1)。`vanishing_llm.py` → `app.models.project.Project`(既存)。
- 64-3: `DeleteProjectButton.tsx` → `deleteProject`・`removeProject`(64-3)・`ApiError`・`StyledButton`(既存)・`@tamagui/toast` の `useToastController`。`AppToast.tsx` → `@tamagui/toast`。`providers.tsx` → `AppToastProvider`(64-3)。
- 64-4: `ProjectListItem.tsx`・2つの画面 → `DeleteProjectButton`(64-3)。`DocumentsPageContent.tsx` → `projectTitle`(64-4 の `documents-store.ts`。表で先に置く)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: devex-api は 64-1・64-2 のテストと、変えたジョブの既存のテスト(文書の生成・レビュー・判定・段階の生成。131件)。devex-ui はダッシュボード・文書・詳細設計の画面・`src/app`・`src/components/layout`(30ファイル・119件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1288 件成功**(12 件は integration で除外)。integration **12 件成功**(既存を含む全部。実際の PostgreSQL)。devex-ui **948 件成功**(142 ファイル。`--maxWorkers=4`)。
  - devex-ui は、並列の数を絞らずに流すと、無関係のファイルの最初のテストが 5 秒で止まった(持ち越しの「並列のテストのタイムアウト」と同じ症状)。`--maxWorkers=4` で通る。
- `ruff check`・`pyright`(変えたファイルとテスト)・`tsc --noEmit` 成功。`npm run lint`: エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- マイグレーション: dev の DB で head が1つ(`7c3e9ab5f4d6`)であることを確かめ、upgrade → `7c3e9ab5f4d6` への downgrade → upgrade を往復した(`8d4f1a2b6c3e`)。
- ブラウザでの確認(Playwright のスクリプト。dev の UI と API。利用者を2人登録し、プロジェクトは LLM を呼ばないよう DB に直接作った):
  - カードの右端にゴミ箱。押すとアラートダイアログ(`role="alertdialog"`)が開き、キャンセルで閉じてカードは残る。
  - 「削除する」でカードが消え、右下に「「削除テストA」を削除しました」のトースト。
  - 生成中(状態が `generating`)のプロジェクトを文書の画面の「削除」から削除できる(「再生成中...」の隣でも押せる)→ `/dashboard` に移り、トーストが出る。
  - 詳細設計の画面の「削除」→ 本文は「このプロジェクトと、…」→ `/dashboard` に移り、一覧が空になる。
  - 削除したプロジェクトの文書の画面を開くと、「Project … not found」(存在しない ID と同じ)。
  - 物理削除: 削除した3件のプロジェクトとチャットの行は、DB に残っていない。
  - コンソール: React のエラーは 0。AlertDialog の「説明が要る」の警告(開発時だけ)が出るが、開いた状態では `aria-describedby` が本文を指している(ライブラリが開く前に確かめるための誤検知)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 696 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。途中で消える場合は、偽 LLM(`VanishingLLM`)と integration のロックの再現で確かめた。

## 未消化の申し送り(#37)

Phase 63 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 65〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase でも devex-ui で並列の数を絞らないと出た)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 65〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜64 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **確認メールの送信**: 範囲の外。
- **`users` テーブルの表のずれ**: [内部設計書](../../docs/internal_design.md) 3.2節(Phase 66 の改名で触る見込み)。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(この Phase)は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。
- **マイページの項目**: Phase 66 で CONTENTS に足す。
- **メールとパスワードの変更の後の印**(→ 66): パスワードの変更で refresh を全部失効させるとき、今の端末のログインを保たないなら、印も消す。
- **登録の上限と手元の確認**: この Phase でも、integration の流し直しで登録・ログインの上限(10回/時)に当たった。この Phase の integration のテストは利用者を DB に直接作る形にした。既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、流し直すと当たる。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題(追記した)。

この Phase で生まれたもの:

- **削除したプロジェクトの URL を開いたときの表示**: 「Project {id} not found」(英語の ID 入りの文)がそのまま出る。存在しない ID と同じ既存の表示で、削除の後にブックマークなどから開くと目に入る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**: Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知。開発時だけ)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**: `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **セッションの区切りの記録**: Phase 64 は1セッションで行った(計画モードで調査 → 質問1回(3問)→ 計画の差し戻し1回 → 承認 → 64-1〜64-4 の実装 → ブラウザでの確認(トーストの API を替えた)→ samples → docs → 教材)。

この Phase で解決したもの:

- **61-3 の Phase 64 の未確定事項**(消失への強さの作り方・削除した後に動いていた処理の記録・確認の文言): 着手時の相談と [64-1](./Phase-64-1.md)・[64-2](./Phase-64-2.md)・[64-3](./Phase-64-3.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 生成中のプロジェクトを物理的に `DELETE` すると、なぜ数分待たされるのか。削除の印の更新は、なぜ待たされないのか。
2. 物理削除で `FOR UPDATE SKIP LOCKED` と `lock_timeout` の両方が要るのはなぜか(親の行のロックと、子の行のロック)。消し残った行が害にならないのはなぜか。
3. バックグラウンドの処理が、失敗を記録する前に消失を確かめるのはなぜか。確かめずに書くと何が起きるか。
4. `commit_if_live` が、確かめてから commit するまでの競合を許してよいのはなぜか。
5. 確認・API の呼び出し・トーストを `DeleteProjectButton` 1つにまとめたのはなぜか。トーストをルートに置くのはなぜか。

## 次のフェーズ

**Phase 65**: 一覧の検索・絞込み・ページネーション(`GET /projects?q=&mode=&status=&page=` → `{items, total}`・`listProjects`・dashboard-store の cache・検索と絞込みとページの部品)。この Phase で組み直したカードと、削除の `removeProject` の上に作る(ページの途中で削除したときの `total` の扱いも決める)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(検索の入力の確定・絞込みの組み合わせ・ページの番号を URL に持つか・cache の鍵)を決める。
