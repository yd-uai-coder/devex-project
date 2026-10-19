# Phase 65 導入: 一覧の検索・絞込み・ページネーション(ステージ9)

## 目的

ステージ9の4つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 65 として、ダッシュボード(SCR-002)のプロジェクトの一覧に、タイトルの部分一致の検索・モードと進行状態の絞込み・10件ずつのページを置く([外部設計書](../../docs/external_design.md) 2.12節)。

- 一覧の API を、条件で絞って1ページずつ返す形にする ── [65-1](./Phase-65-1.md)
- 条件の型・URL との変換・ストアの cache を作り直す ── [65-2](./Phase-65-2.md)
- 検索・絞込みの部品とページ送りを画面に置く ── [65-3](./Phase-65-3.md)

## パイプライン上の位置づけ・前提

```
URL /dashboard?q=&mode=&status=&status=&page=
   │ useSearchParams → parseListParams          (65-2 list-params)
   ▼
ProjectList ──[65-3]── ProjectListControls(検索: Enter・ボタン / モード / 状態(複数)/ クリア)
   │                     └ onChange → toSearchParams → router.push(ページは1に)
   │ fetchProjects(params)  ── cache: 条件の鍵が同じで20秒以内なら省く(65-2 dashboard-store)
   ▼
GET /api/v1/projects?q=&mode=&status=&page= ──[65-1]── list_page → search_for_user
   └ {items: 10件まで, total: 条件に合う全件数}
   ▼
カード(Phase 64 の ProjectListItem・削除ボタン)+ DataPagination(2ページ以上のとき)
   └ 削除 → removeProject(外す・total-1・cache を切る)→ 今のページを取り直す → 範囲外なら最後のページへ replace
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 65 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節「一覧の検索・絞込み・ページネーション」、[内部設計書](../../docs/internal_design.md) 3.3節「一覧」。
- **今の仕組み**: `GET /projects` は引数を取らず、全件を配列で返す。UI は全件を `dashboard-store` に持ち(20秒の TTL の cache)、全部を描く。[Phase 64](../Phase-64/Phase-64-introduction.md) で、カードはリンクと削除ボタンを兄弟に組み直し、削除はストアの `removeProject` で一覧から外す形になった。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `ffb243c`、devex-ui は `50260e5`(Phase 64)。外側のリポジトリは Phase 64 までコミット済み(`be9e2ce`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。`e2e/helpers.ts` は一覧の API の応答も、一覧の画面の文言も使わない(「新規プロジェクトを作成」のボタンとモード選択ダイアログだけ)ので、応答の形の変更で壊れない。画面の流れは、Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 65 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 検索の確定 | **Enter・「検索」ボタンで確定**(推奨は入力ごと300ms。推奨と違う) |
| 3 | 絞込みの組み合わせ | **進行状態は複数を選べる**(OR)。モードは1つ。両者は AND(推奨はどちらも1つ。推奨と違う) |
| 4 | 条件とページを URL に持つか | **URL に持つ**(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- cache の鍵は条件の文字列(状態を定めた順に並べ、既定値を省いたクエリ)。ストアは最後の1つだけ持つ([61-3](../Phase-61/Phase-61-3.md) の未確定事項)。
- ページの途中で削除したら、カードを外して `total` を1減らし、cache を切って今のページを取り直す(次のページの先頭が繰り上がる)。取り直してページが空なら最後のページへ置き換える([Phase 64](../Phase-64/Phase-64-introduction.md) の「次のフェーズ」で挙げた `total` の扱い)。
- 最後より後のページを API が受けたら、エラーにせず空の `items` と本当の `total` を返す。
- 既存の部品は `DataPagination` だけを使う(`useFilterSortPagination` はクライアントで切る仕組み、`DataFilter` は1つのキーしか持てない)。
- **作業中**: モードは計画ではセレクトだったが、選択肢が3つで状態のチェックボックスと並べやすいラジオにした。さらに `RadioGroupWithLabel` は幅が固定(既定300)で選択肢が折り返したので、見出し + 選択肢の並びを部品の中で組んだ。ブラウザで 375px の幅を確かめると選択肢が折り返さずにはみ出たので、`RadioGroupWithLabel.module.css` の回避策(Tamagui の View の既定の `flex-shrink: 0` を外す)を当てた([65-3](./Phase-65-3.md))。
- **作業中**: クエリの引数の名前を `status` にすると、ルートのファイルが import している `fastapi.status` を隠すので、引数は `statuses`・クエリの名前は `alias="status"` にした([65-1](./Phase-65-1.md))。
- **作業中**: テストで `useSearchParams` のモックが描画のたびに新しいオブジェクトを返すと、取り直しが止まらなかった。モックは URL が変わるまで同じオブジェクトを返す(Next.js 本体と同じ)([65-3](./Phase-65-3.md))。

- **完了後の調整(ユーザー)**: `ProjectListControls.tsx` の配置を直した(検索欄を左に寄せる・モードと進行状態と「条件をクリア」を縦に積む・「条件をクリア」を緑のボタンに)。Claude は `alignItems="left"`(型に無い値で `tsc` が失敗)を `flex-start` に、使われなくなった `Button` の import を外し、samples と [65-3](./Phase-65-3.md) に反映した。検索欄の `maxWidth` 480px は本体のコミットに無く、samples にだけ残っていた。ステージ9の振り返りで本体を正とし、samples から外した([overall-retrospective](../retrospectives/overall-retrospective.md) 14節)。

推奨と違った選択は2つ(検索の確定・状態の複数選択)。計画の差し戻しは無し。完了後の調整は1回(配置)。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-65-1.md`](./Phase-65-1.md) | 一覧の API(検索・絞込み・ページ) | あり(本体 4 + テスト 6) | なし |
| [`Phase-65-2.md`](./Phase-65-2.md) | 一覧の条件と取得(api・ストア) | あり(本体 3 + テスト 4) | 65-1(`{items, total}`) |
| [`Phase-65-3.md`](./Phase-65-3.md) | 検索・絞込み・ページの画面 | あり(本体 4 + テスト 3) | 65-2(`list-params`・ストア) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新:

- 65-1: `app/schemas/project.py`・`app/repositories/project.py`・`app/services/project.py`・`app/api/routes/projects.py`・`tests/unit/test_project_list.py`(新規)・`tests/unit/test_project_repository.py`・`tests/unit/test_project_service.py`・`tests/unit/test_project_delete.py`・`tests/integration/test_project_list_flow.py`(新規)・`tests/integration/test_project_delete_flow.py`
- 65-2: `src/features/dashboard/list-params.ts`(新規)・`src/features/dashboard/api/projects.ts`・`src/features/dashboard/dashboard-store.ts` とテスト4つ(`list-params.test.ts` は新規)
- 65-3: `src/features/dashboard/components/ProjectListItem.tsx`・`src/features/dashboard/components/ProjectListControls.tsx`(新規)・`src/features/dashboard/components/ProjectList.tsx`(旧コード全体をコメントアウトして作り直し)・`src/app/dashboard/page.tsx` とテスト3つ(`ProjectListControls.test.tsx` は新規)
- ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [65-1](./Phase-65-1.md) | `ProjectListPage`・`search_for_user`・`list_page`・`GET /projects` | 条件で絞り、更新順の10件と全件数を返す | 部分一致(大小文字・`%`/`_`)・モードと複数の状態の AND/OR・削除の印と他人は出ない・10件で切れて `total` は全件・範囲外のページ・不正な値は 422・(Postgres)ILIKE |
| [65-2](./Phase-65-2.md) | `list-params.ts`・`listProjects`・`dashboard-store` | 条件を URL・API・cache の鍵に同じ規則で直す / 条件の鍵ごとの cache と古い応答の破棄 | 読み取りと書き出し(不正な値・順・既定値)・同じ条件で cache・条件の変更で取り直す・古い応答を捨てる・削除で外して `total` を減らし cache を切る |
| [65-3](./Phase-65-3.md) | `ProjectListControls`・`ProjectList`・ページ | 条件の入力(URL を知らない)/ URL を読んで取り、変更を URL に書く | Enter・ボタンで確定し入力中は呼ばない・状態の複数選択・条件の変更でページを1に・ページ送り・0件の2つの表示・範囲外の置き換え・削除の後の取り直し |

## 写経順序(#23)

章番号順(65-1 → 65-2 → 65-3)。各章の表の順(依存順。#30)に写す。マイグレーションは無い。

- 65-2 でストアの形(`projects` → `items`)が変わるので、65-2 だけを写した時点では `ProjectList.tsx` の型が合わない。`tsc` とダッシュボードの画面のテストは 65-3 まで写してから流す(65-2 のテストはストア・api・`list-params` だけを import するので、65-2 の時点で通る)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 65-1: `repositories/project.py` → `collections.abc.Sequence`・`sqlalchemy.func`(標準・外部)。`services/project.py` → `PROJECT_PAGE_SIZE`・`ProjectListPage`(65-1 の `schemas/project.py`。表で先に置く)・`ProjectRead`・`ProjectStatus`(既存)。`routes/projects.py` → `fastapi.Query`・`ProjectListPage`(65-1)・`ProjectStatus`(既存)。`test_project_list.py` → `get_current_user`・`get_db`・`router`(既存)・`PROJECT_PAGE_SIZE`(65-1)。
- 65-2: `list-params.ts` → `ProjectMode`・`ProjectStatus`(既存の `api/projects.ts`。型だけ)。`api/projects.ts` → `toSearchParams`・`ProjectListParams`(65-2 の `list-params.ts`。表で先に置く)。`dashboard-store.ts` → `listParamsKey`・`ProjectListParams`(65-2)。
- 65-3: `ProjectListControls.tsx` → `STATUS_LABEL`(65-3 で export。表で先に置く)・`DEFAULT_LIST_PARAMS`・`PROJECT_STATUSES`・`hasConditions`(65-2)・`toProjectMode`・`CheckboxGroup`・`RadioGroupItem`・`StyledButton`・`RadioGroupWithLabel.module.css`(既存)。`ProjectList.tsx` → `ProjectListControls`(65-3)・`PROJECT_PAGE_SIZE`・`hasConditions`・`listParamsKey`・`parseListParams`・`toSearchParams`(65-2)・`DataPagination`(既存)。`page.tsx` → `react` の `Suspense`。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: devex-api は 65-1 のテストと、変えたテスト(40件)。devex-ui はダッシュボードの機能とページ(8ファイル・43件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1296 件成功**(14 件は integration で除外)。integration **14 件成功**(既存を含む全部。実際の PostgreSQL。この Phase で2件増えた)。devex-ui **970 件成功**(145 ファイル。`--maxWorkers=4`)。
- `ruff check`・`pyright`(変えたファイルとテスト)・`tsc --noEmit` 成功。`npm run lint`: エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- マイグレーション: 無し。
- dev の API への直接の問い合わせ(利用者を API で1人登録し、プロジェクト13件は DB に直接作った): `?q=備品&status=completed&status=revising` で2件・`total` 2、`?page=2` で3件・`total` 13。
- ブラウザでの確認(Playwright のスクリプト。dev の UI と API):
  - 1ページ目に10件と「1 / 2 ページ(全13件)」。次へで `?page=2` に3件。
  - 検索の入力の途中では URL が変わらない。Enter で `?q=備品` になり3件(ページは1に戻る)。
  - 状態の「完了」「修正中」を続けて押すと `&status=completed&status=revising` で2件。モードの「詳細設計」で1件。
  - ブラウザの戻るで前の条件の2件に戻る。読み込み直しても同じ一覧で、入力欄に「備品」が残る。
  - 「条件をクリア」で `/dashboard` に戻り、入力欄も空になる。
  - 2ページ目で削除: 全件数が 13 → 12 → 11 と減り、2ページ目の最後の1件を消すと `/dashboard`(1ページ目)に移り、ページ送りが消える。
  - `?page=9` を開くと `/dashboard` に置き換わる。
  - 幅 375px で選択肢が折り返し、横にはみ出さない(`scrollWidth` 375)。完了後の調整の後も、幅 1280px・375px で崩れず、はみ出さないことを確かめた。
  - コンソールのエラー: 0(1回目の流しで出た 401 は、ログイン前の refresh の既存の応答)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 702 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

Phase 64 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 66〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase も devex-ui は `--maxWorkers=4` で流した)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 66〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜65 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **確認メールの送信**: 範囲の外。
- **`users` テーブルの表のずれ**: [内部設計書](../../docs/internal_design.md) 3.2節(Phase 66 の改名で触る見込み)。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(この Phase)は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。
- **マイページの項目**: Phase 66 で CONTENTS に足す。
- **メールとパスワードの変更の後の印**(→ 66): パスワードの変更で refresh を全部失効させるとき、今の端末のログインを保たないなら、印も消す。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。この Phase の integration のテストも利用者を DB に直接作る形にした。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。

この Phase で生まれたもの:

- **新規作成の後の一覧の cache**: `dashboard-store` の `invalidate` を呼ぶ所が無い(以前から)。プロジェクトを作ってから20秒以内に、同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない(作成の後はチャットの画面へ移るので、ふつうは20秒を過ぎる)。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**: 幅 375px で「ダッシュボード」の見出しが3行に折り返す(以前から。新規作成のボタンと横に並ぶため)。Phase 72 の画面確認で見る。
- **セッションの区切りの記録**: Phase 65 は1セッションで行った(計画モードで調査 → 質問1回(4問)→ 計画の承認 → 65-1〜65-3 の実装 → ブラウザでの確認(モードのラジオの並びを直した)→ samples → docs → 教材)。

この Phase で解決したもの:

- **61-3 の Phase 65 の未確定事項**(検索の入力の確定・絞込みの組み合わせ・ページの番号を URL に持つか・cache の鍵): 着手時の相談と [65-2](./Phase-65-2.md)・[65-3](./Phase-65-3.md)。
- **Phase 64 の「次のフェーズ」で挙げた、ページの途中で削除したときの `total` の扱い**: [65-2](./Phase-65-2.md)(`removeProject`)・[65-3](./Phase-65-3.md)(取り直しと最後のページへの置き換え)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 一覧の並びに `id` を足したのはなぜか。`updated_at` だけで `OFFSET` を使うと何が起きるか。
2. 検索語の `%`・`_` をエスケープしないと、どんな検索で困るか。
3. cache の鍵を条件の文字列にしたとき、条件が変わったら `fetchedAt` も消すのはなぜか。待つ間に条件が変わった応答を捨てるのはなぜか。
4. ページの途中で削除したとき、カードを外すだけでなく今のページを取り直すのはなぜか。最後のページより後になったとき、`push` でなく `replace` で移るのはなぜか。
5. 検索・絞込みの部品(`ProjectListControls`)に URL を知らせず、`value` と `onChange` だけを持たせたのはなぜか。

## 次のフェーズ

**Phase 66**: マイページのアカウント(`full_name` → `user_name` の改名(Alembic・スキーマ・画面)・`PATCH /users/me`・メールとパスワードの変更(今のパスワードで確かめる・refresh を全部失効)・`/mypage` の新設とメニューの項目)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(変更の API の形・パスワードの規則・変更の後に今の端末のログインを保つか)を決める。改名は E2E の登録の手順(`helpers.ts` の「氏名」)に効くかも確かめる。
