# ステージ9・10 の影響調査と計画

> ステージ8 の完了後、ユーザーとの相談(2026-10-16)でロードマップを改めた。旧ステージ9(設計・実装の整合性検証)と旧ステージ10(GitHub / CI/CD・運用)は実施せず、使い勝手とアカウント・モデル設定の調整(新ステージ9)、Google 認証(新ステージ10)に置き換えた。経緯は [`q_a.md`](../textbook/q_a.md)「ステージ8完了後 ── ロードマップの修正(新ステージ9・10)」にある。
>
> このファイルは各ステージの着手前に作った影響調査と計画の案である。Phase の教材には入れていない。各ステージの着手時に、#28 の仕様診断で未決事項を決め、[`docs/implementation_plan.md`](../docs/implementation_plan.md) 4.1節に書き写す。行番号は 2026-10-16 時点のものである。

## 1. 新ステージ9:使い勝手とアカウント・モデル設定の調整

### 1.1 要望(ユーザーの原文を要約)

1. ヘッダーをクリックするとトップページに遷移する。
2. ログアウトの機能。
3. 認証ページ: ログイン状態でユーザー登録・ログインのページを開くと、その画面を経由せずダッシュボードへ遷移する(メッセージは出さない)。汎用の機能(ミドルウェア)として作る(テンプレート反映候補)。
4. ダッシュボード: 進行状態の右に削除ボタンを置く。タイトルの部分一致で検索し、モード(簡易・詳細)と段階で絞り込む。1ページ10件で区切る。
5. マイページ:
   - ユーザーネーム・メールアドレス・パスワードを変更できる。
   - 用途ごとにモデルを登録する。AI(Gemini・Claude)を選ぶと、選べるモデルが変わる。今 API が公開されている Gemini の Flash 系と Claude のモデルを選べるようにする。
   - API キーを登録する。superuser でなくても、自分でキーを取れば使えるようにする。superuser は、別の専用コンテンツを作る可能性を見て残す。
   - 今 `.env` にあるモデルとキーは、seed で DB に登録する(seed.py は `.env` を読む。値を直接書かない)。
6. 作成済みのプロジェクトのチャット画面は、最下部までスクロールした状態(送信ボタンが見える状態)で表示する。
7. 文書(レビュー)と詳細設計(編集)の画面に削除ボタンを置く。「チャットへ戻る・詳細設計へ進む」などの並びの一番右に置く。
8. グローバルメニュー: メニューから新規作成するときも、ダッシュボードと同じようにモードを選ぶダイアログを出す。階層は次のとおりにする。
   ```text
   TOP
   CONTENTS        ダッシュボード / 新規プロジェクト作成 / マイページ
   Authentication  ログイン / ユーザー登録 / ログアウト
   Guide           作成予定(仮のリンク。開くと 404)
   ```

### 1.2 影響調査

| # | 項目 | 現状 | 影響範囲 | 規模 |
|---|---|---|---|---|
| 1 | ヘッダーからトップへ | `devex-ui/src/components/layout/Header.tsx:28-35` のタイトルは `<H3>` で、リンクではない | リンクにする | 小 |
| 2 | ログアウト | API の `POST /auth/logout`(refresh を失効させ、cookie を消す)と、`devex-ui/src/components/auth/auth-store.ts:41` の `logout()` はあるが、押すボタンが無い | メニューにボタンを置き、押したら `/` へ遷移する。アクセストークンを失効させる仕組みは無く、最大30分は有効のまま残る(メモリから消すので実害は小さい) | 小 |
| 3 | 認証ページを飛ばす | Next.js 16.3.6 では `middleware.ts` が非推奨になり、`src/proxy.ts` に替わった。どちらのファイルも無い。アクセストークンはメモリ(Zustand)にしかなく、refresh cookie は API のオリジンの `path=/api/v1/auth` にある。そのため、proxy からはログインの状態が見えない | UI のオリジンにフラグ cookie を置く(login・refresh で付け、logout・401 で消す)。`src/proxy.ts` で `/login`・`/register` を `/dashboard` へ飛ばす。フラグが古いときは、既存の `RequireAuth` が受け止める | 中 |
| 4a | 一覧の削除 | 削除の API が無い。外部キーは ORM・DB ともに CASCADE で、子の9テーブルと review の孫まで消える。Redis の生成の進み具合は残る。カードは全体が `<Link>` になっている | `DELETE /projects/{id}`(所有者だけ)。カードの組み方を変え、リンクと削除ボタンを兄弟にする(進行状態の右)。確認には既存の `ConfirmDialog` を使う | 中 |
| 4b | 検索・絞込み・ページネーション | `GET /projects` はパラメータを取らず、配列を返す | `q`(タイトルの部分一致)・`mode`・`status`・`page`(10件ずつ)を受け、`{items, total}` を返す。**レスポンスの形が変わる** → `listProjects`・dashboard-store(20秒の TTL の cache)・テストを直す。既存の `DataFilter`・`DataPagination`・`useFilterSortPagination` を使えるか確かめる | 中〜大 |
| 5a | マイページ: アカウント | `username` の列は無く、`full_name` が表示名を兼ねる。`UserUpdate` のスキーマは定義済みだが使われていない。更新の API は無い | `PATCH /users/me`(表示名)、メールとパスワードの変更(今のパスワードで確かめる)。パスワードを変えたら、その人の refresh を全部失効させる(Redis の `refresh_token:{user_id}:*`)。UI に `/mypage` を新設する | 中 |
| 5b | モデルと API キーの登録 | モデルは `.env` の値が全体で1つ(`GEMINI_MODEL`・`REVIEW_MODEL`・`JUDGE_MODEL`)。キーは `GOOGLE_API_KEY`・`ANTHROPIC_API_KEY`。暗号化の仕組みは無い | 新しいテーブルを作る: ユーザーごと・用途(チャット・生成・レビュー・判定)ごとの provider とモデル、provider ごとの API キー(Fernet で暗号化し、鍵は env に置く)。システムの既定値は、user_id が null の行で持つ。モデルの一覧は API 側に静的なカタログとして持ち、UI は provider で絞り込む。`scripts/seed.py` は `.env` を読んで既定値を登録する。Alembic は head `7c3e9ab5f4d6` の次に足す | 大 |
| 5c | LLM の呼び出しをユーザーごとに | factory は `lru_cache` でプロセスに1つ(`app/ai/llm/gemini.py:10`・`claude.py:69,95`)。Gemini を呼ぶのは chat_service(3か所)・doc_generator・design_stage_generation・intake_file_processor・/chat の graph。Claude を呼ぶのは review_service と fix_check_service | factory を「ユーザーと用途 → LLM」に作り替え、cache の鍵を (provider, model, key) にする。呼び出し箇所は8つほど。用途ごとに provider を入れ替えられるので、provider 固有の処理(`extract_text_content`・構造化出力・`max_tokens`・`llm_retry` の 429 の判定)を両方の provider で通す必要がある。`review_effective` の条件を「superuser かつオン」から「使えるキーがある、かつオン」に改める | 大 |
| 6 | チャットを最下部で表示 | `devex-ui/src/features/hearing/components/ChatPanel.tsx` にスクロールの処理が無い(ページ全体がスクロールする) | 履歴を読み込んだ後に、一度だけ最下部へスクロールする | 小 |
| 7 | 文書・詳細設計の画面の削除ボタン | 並びは `DocumentsPageContent.tsx:105-137`(右端は「再生成する」)と `DetailedDesignPageContent.tsx:121-126` | 4a の削除を共通の部品にし、並びの右端に置く。削除したら `/dashboard` へ | 小 |
| 8 | グローバルメニュー | `devex-ui/src/lib/menu-tree.ts` は1グループ・4項目。メニューの「新規プロジェクト作成」は `/projects/new` へ飛び、`toProjectMode` が `simple` に倒すので、ダイアログを経ない。404 ページはある(`MENU_TREE` を使う) | `MENU_TREE` を TOP / CONTENTS / Authentication / Guide に組み直す(トップページと 404 にも効く)。`/projects/new` に mode が無ければ `ModeSelectDialog` を出す(メニューと URL の直打ちの両方に効く)。ログアウトは遷移でなく処理なので、項目の型に action を足す。Guide は仮のリンクにする | 中 |

### 1.3 決定(相談で決めたこと)

1. **キーの扱い**: `.env` のモデルとキーは、seed で「システムの既定値」として登録する。ユーザー自身のキーがあれば、そちらを優先する。キーを登録していないユーザーも、今と同じく既定の Gemini でチャットと生成ができる。レビューは、自分のキーを登録したユーザーなら superuser でなくても使える。
2. **絞込みの「段階」** は進行状態(`project.status`: ヒアリング中・生成中・完了・修正中)とする。詳細設計の段階は使わない。
3. **認証ページ**は、proxy と UI のオリジンのフラグ cookie で飛ばす。テンプレート反映候補として [`retrospective-memo.md`](../textbook/retrospective-memo.md) に記録した。
4. **判定のモデル**(今の Claude Haiku。レビューの指摘が再生成で直ったかを確かめる)は、4つ目の用途として登録する。画面には、何に使うモデルかの説明と、呼ぶ回数が多いため費用の低いモデルを推奨する注記を出す。

### 1.4 Phase の分け方(案。番号は着手時に決める)

| 順 | 内容 | 項目 |
|---|---|---|
| 1 | 画面の小さな調整: ヘッダーのリンク・ログアウト・メニューの組み直し・メニューからのモードの選択・チャットのスクロール | 1, 2, 6, 8 |
| 2 | 認証ページの proxy(フラグ cookie と `src/proxy.ts`) | 3 |
| 3 | プロジェクトの削除(API・一覧・文書の画面・詳細設計の画面) | 4a, 7 |
| 4 | 一覧の検索・絞込み・ページネーション | 4b |
| 5 | マイページのアカウント | 5a |
| 6 | モデルと API キーの登録(テーブル・暗号化・カタログ・seed・API・マイページの UI) | 5b |
| 7 | LLM の呼び出しをユーザーごとに解決する(factory・呼び出し箇所・review の条件) | 5c |
| 8 | 全 E2E と本番(暗号の鍵・マイグレーション・seed の手順を `OPERATIONS.md` に書く) | ― |

着手時の要件定義の Phase(ステージ5〜8 の最初の Phase と同じ形)を置くかは、着手時に決める。UI の調整が中心なので、ベースラインと見本は省いてよい。

### 1.5 未決事項(着手時の仕様診断 #28 で決める)

> **Phase 61 で決めた**: 下の未決事項は [Phase 61-1](../textbook/Phase-61/Phase-61-1.md) の仕様診断ですべて決め、Phase の分け方は [61-3](../textbook/Phase-61/Phase-61-3.md)(Phase 62〜72)に改めた。

- 生成中のプロジェクトを削除できるか(409 で断るか)。
- 既定の(`.env` の)キーでレビューを使えるのを、superuser に限るか。
- PDF の取り込み(マルチモーダル)のモデルを、Gemini に固定するか。
- Gemini・Claude のモデルカタログの中身(着手時に、公開されているモデルを調べる)。
- メニューの認証の項目を、ログインの状態で出し分けるか。
- ステージ8 の「次のステージの入力」11件([`Phase-60-introduction.md`](../textbook/Phase-60/Phase-60-introduction.md) の未消化の申し送り)を範囲に入れるか。特に「生成のモデルと Gemini の無料枠」は、5b・5c と関わる。

### 1.6 壊れるテストと改訂する docs

- devex-ui のテスト: `Menu.test.tsx`、dashboard のページ・`ProjectList`・`dashboard-store`・`projects.test.ts`、`ChatPanel.test.tsx`、login と register のページ。E2E は、`e2e/helpers.ts` が使う文言(「新規プロジェクトを作成」)と aria-label(「…で作成する」)を残せば壊れない見込み。#36 に従い、最後の Phase で全 E2E を流す。
- devex-api のテスト: `test_project_*`、`test_review_routes`、`test_gemini`・`test_review_llm`・`test_llm_retry`、`test_seed_*`。
- docs: `requirements.md:146`(Gemini Flash-Lite に固定)、`external_design.md:38-39`(SCR-001・002)・`:128`(キーは環境変数)・`:489`(レビューは superuser だけ)、`internal_design.md:538`(モデルは設定で替える)。マイページの SCR を新設する。

## 2. 新ステージ10:Google 認証

### 2.1 影響調査

- **API**: `users.hashed_password` を null 可にする(Google だけで登録したユーザー)。`users` に Google の識別子(`google_sub`)を足す。`POST /auth/google` を作り、Google の ID トークンを検証して、自前の JWT と refresh cookie を発行する(既存の `_set_refresh_cookie` を使う)。レート制限は `AuthRateLimiter` に足す。
- **UI**: ログインと登録の画面に Google のボタンを置く。成功したら、ステージ9 のフラグ cookie を付ける。
- **ステージ9 との関わり**: マイページで、Google だけのユーザーには、パスワードの「変更」でなく「設定」を出す。メールの変更は禁止する(または Google に従う)。ログアウトは今のままでよい。
- **本番**: Google Cloud の OAuth クライアント・リダイレクト URI・同意画面を用意する。手順を `OPERATIONS.md` に書く。
- **E2E**: 本物の Google は自動化できないので、偽の検証(`E2E_FAKE_LLM` と同じ要領のフラグ)を用意する。

### 2.2 Phase の分け方(案)

API(モデル・マイグレーション・トークンの検証・発行)→ UI(ボタン・マイページの出し分け)→ E2E と本番の設定。

### 2.3 未決事項

- Authorization Code のフローにするか、ID トークン(Google Identity Services)にするか。
- 同じメールの既存アカウントと紐付けるか。
- 使うライブラリ(`google-auth` など。着手時に Context7 で確かめる)。
