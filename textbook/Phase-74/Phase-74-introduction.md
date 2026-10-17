# Phase 74 導入: Google 認証の API(ステージ10)

## 目的

ステージ10の最初の実装 Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 74 として、Google アカウントでのログイン・登録と、同じメールの既存アカウントとの連携を API に作る([外部設計書](../../docs/external_design.md) 2.13節、[内部設計書](../../docs/internal_design.md) 3.3節 10項)。画面は Phase 76、マイページの API(パスワードの設定・連携・解除)は Phase 75 で作る。

- `users` に `google_sub` を足し、パスワードを null 可にする ── [74-1](./Phase-74-1.md)
- ID トークンを検証する部品と設定を作る ── [74-2](./Phase-74-2.md)
- `/auth/google`・`/auth/google/link`・`google_ip` の上限・開発用の上限 ── [74-3](./Phase-74-3.md)

## パイプライン上の位置づけ・前提

```
画面の Google のボタン(Phase 76)── credential(Google が署名した ID トークン)
   │
   ▼ POST /auth/google {credential}                                         ──[74-3]
   google_ip を数える → 検証(GoogleTokenVerifierDep)                          ──[74-2]
        ├ 本物: verify_oauth2_token(署名・iss・aud=GOOGLE_CLIENT_ID・exp)、threadpool
        ├ 偽物: E2E_FAKE_GOOGLE なら fake:<sub>:<email>(本番では起動時に拒否)
        └ GOOGLE_CLIENT_ID が無ければ 503
   → GoogleAuthService.login_or_register
        ├ email_verified が false → 400
        ├ google_sub で一致 → その人                                          ──[74-1 の列]
        ├ メールで一致・未連携 → 409 GOOGLE_LINK_REQUIRED ─┐
        ├ メールで一致・別の Google と連携済み → 409 GOOGLE_ACCOUNT_CONFLICT
        └ どちらにも無い → パスワードの無い利用者として登録
   → access(本文)+ refresh(Cookie)。/auth/login と同じ                       │
                                                                            ▼
   POST /auth/google/link {credential, password}(画面は credential を保ったままパスワードを聞く)
   google_ip → 検証 → enforce_login(IP・メール)→ パスワードが合えば google_sub を記録 → 同じ発行
```

- **前提として読むもの**: [73-1](../Phase-73/Phase-73-1.md)(決定と Claude の判断)・[73-3](../Phase-73/Phase-73-3.md)(Phase 74 のスコープと未確定事項)・[外部設計書](../../docs/external_design.md) 2.13節・[内部設計書](../../docs/internal_design.md) 3.3節 10項。
- **今の仕組み**: ログインはメールとパスワードだけ。access は本文、refresh は API のオリジンの httpOnly cookie(`app/api/refresh_cookie.py`)。`hashed_password` は NOT NULL。認証のカウンタは `login_ip`・`login_email`・`register_ip` の3つ(30・20・10回/時)。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `fba3502`、devex-ui は `c11673a`、外側のリポジトリは `e5dbcba`(Phase 71)。ステージ9の振り返りと Phase 72・73 の分は、3つのリポジトリで未コミットだった(devex-api は `OPERATIONS.md`・`docker-compose.e2e.yml`)。この Phase はその上に重ねた。alembic の head は `b8e4d0f2a6c3`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ10の E2E は Phase 79 で既存を含めて全部流す)。E2E 用に `docker-compose.e2e.yml` に `E2E_FAKE_GOOGLE: "true"` を足した。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 74 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 連携の確かめでパスワードが違うときのコード | ログインと同じ 401(推奨どおり) |
| 3 | 同じメールのアカウントが、別の Google と連携済みのときの応答 | 409 `GOOGLE_ACCOUNT_CONFLICT`(推奨どおり) |
| 4 | 上限の値 | `google_ip` は 30回/時。開発用の compose で4つを 1000回/時(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 偽の credential は `fake:<sub>:<email>`(名前はメールのローカル部、メールは確認済み)。
- 公開鍵を取りに行けないとき(`TransportError`)は 502 `GOOGLE_VERIFY_FAILED`(credential の良し悪しが分からないため、401 にしない)。
- `verify_password` は変えず、照合する側で null を弾く。マイページの今のパスワードも、null なら不一致(400)。
- 同じ Google での連携のやり直しは成功として扱う。連携の確かめでは、パスワードを確かめてから連携済みの判定をする。
- **作業中**: `docker-compose.e2e.yml` に `E2E_FAKE_GOOGLE` を足した(計画に無かった。Phase 76 の画面の確かめと Phase 79 の E2E で使う)。
- **作業中**: devex-api の `CLAUDE.md` の「レート制限」に、Google のカウンタと開発用の上限を書いた。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-74-1.md`](./Phase-74-1.md) | `users` の変更と、パスワードの照合の null 対応 | あり(本体 6 + マイグレーション 1 + テスト 1) | なし |
| [`Phase-74-2.md`](./Phase-74-2.md) | ID トークンの検証の部品と設定 | あり(本体 3 + 依存 1 + テスト 2) | なし |
| [`Phase-74-3.md`](./Phase-74-3.md) | `/auth/google`・`/auth/google/link`・レート制限・開発の上限 | あり(本体 6 + フィクスチャ 1 + テスト 3) | 74-1(列・`get_by_google_sub`)・74-2(検証・例外・設定) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 74-1: `alembic/versions/c4f8a2e6d1b9_add_google_sub_to_users.py`(新規)・`app/models/user.py`・`app/repositories/user.py`・`app/services/auth.py`・`app/services/user.py`・`app/schemas/user.py`・`app/api/user_read.py`・`tests/unit/test_user_google_columns.py`(新規)
- 74-2: `pyproject.toml`・`app/core/config.py`・`app/services/errors.py`・`app/services/google_identity.py`(新規)・`tests/unit/test_google_identity.py`(新規)・`tests/unit/test_config_safety.py`
- 74-3: `app/services/errors.py`・`app/schemas/auth.py`・`app/services/auth_rate_limit.py`(テンプレート由来。samples に初めて載せた)・`app/services/google_auth.py`(新規)・`app/api/deps.py`・`app/api/routes/auth.py`・`tests/fixtures/fake_google.py`(新規)・`tests/unit/test_google_auth.py`(新規)・`tests/unit/test_auth_rate_limit.py`(テンプレート由来。samples に初めて載せた)・`tests/integration/test_google_auth_flow.py`(新規)
- ミラーしないもの(#21 の共通): `docker-compose.yml`・`docker-compose.e2e.yml`・`.env.example`(ルートと `backend/`)・`uv.lock`。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [74-1](./Phase-74-1.md) | マイグレーション・`User`・`UserRepository`・`authenticate`・`_verify_current_password`・`UserRead`・`user_read` | Google だけの利用者(パスワードが null)を持てるようにし、照合を null で落とさない | `sub` での検索・null のパスワードのログインは同じ 401・今のパスワードは 400・応答の2項目・マイグレーションの往復 |
| [74-2](./Phase-74-2.md) | 設定・4つの例外・`GoogleIdentity`・`GoogleIdTokenVerifier`・`FakeGoogleTokenVerifier`・`get_google_token_verifier` | credential を確かめて本人の値を取り出す(本物・偽物・設定が無ければ 503) | `aud` を渡す・例外の振り分け(401・502)・クレームの欠け・偽物の形・関数の3つの分岐・本番の旗の拒否 |
| [74-3](./Phase-74-3.md) | 409 の2つ・リクエストのスキーマ・`enforce_google`・`GoogleAuthService`・`GoogleTokenVerifierDep`・2つのルート・compose | 本人の値からログインする人を決め、同じメールは確かめてから紐付ける | 登録・`sub` 優先・409 の2つ・400・401 の見分けさせなさ・連携の後の両方のログイン・上限(検証を呼ばない)・実際の DB での流れ |

## 写経順序(#23)

章番号順(74-1 → 74-2 → 74-3)。各章の表の順(依存順。#30)に写す。

- 74-1 のマイグレーションを写したら、`alembic upgrade head` を流してから API を動かす(ORM に `google_sub` の列が増えるため、古い DB のままでは `users` を読むところで失敗する)。
- 74-2 の後に `uv sync`(`pyproject.toml` の直接の依存が増えた。版は変わらない)。
- 74-3 の `docker-compose.yml` の `environment` は、backend のコンテナを作り直すと効く(`docker compose up -d backend`)。

実 import 監査(#15。全 import 文を読んで確かめた):

- 74-1: 新しい import は無い。テスト → `user_read`・`User`・`UserRepository`・`AuthService`・`CurrentPasswordMismatchError`・`InvalidCredentialsError`・`UserService`・`tests.fixtures.fake_redis.FakeRedis`(すべて既存。`get_by_google_sub` はこの章)。
- 74-2: `google_identity.py` → `collections.abc.Mapping`・`dataclasses`・`typing`(標準)・`fastapi.concurrency.run_in_threadpool`・`google.auth.exceptions`・`google.auth.transport.requests`・`google.oauth2.id_token`(外部。この章で直接の依存にした)・`settings`(既存)・`GoogleAuthUnavailableError`・`GoogleTokenInvalidError`・`GoogleVerifyFailedError`(この章の `errors.py`。表で先に置く)。テスト → この章のものと `google.auth.exceptions`・`settings`。
- 74-3: `google_auth.py` → `verify_password`・`User`・`UserRepository`(既存)・`get_by_google_sub`(74-1)・`GoogleEmailNotVerifiedError`(74-2)・`GoogleAccountConflictError`・`GoogleLinkRequiredError`(この章。表で先に置く)・`InvalidCredentialsError`(既存)・`GoogleIdentity`(74-2)。`deps.py` → `GoogleTokenVerifier`・`get_google_token_verifier`(74-2)。`routes/auth.py` → `GoogleTokenVerifierDep`・`GoogleLinkRequest`・`GoogleLoginRequest`・`GoogleAuthService`(この章。表で先に置く)・`User`(既存)。`auth_rate_limit.py` → 新しい import は無い(`settings.GOOGLE_RATE_LIMIT_PER_IP_PER_HOUR` は 74-2)。`fake_google.py` → `GoogleTokenInvalidError`・`GoogleIdentity`(74-2)。テスト → この章のものと既存。integration → `FakeGoogleTokenVerifier`・`get_google_token_verifier`(74-2)・`get_client_ip`・`AsyncSessionLocal`・`hash_password`・`app`・`User`(既存)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: 74-1 は新しいテストと認証・アカウント・改名・ユーザーのテスト(30件)、74-2 は検証と設定のテスト(22件)、74-3 は Google の認証と上限のテスト(23件)。すべて成功。新しいテストは 39件(4・16・19)。
- Phase 完了時の全体テスト(#18): devex-api **1472 件成功**(22 件は integration で除外)。integration **22 件成功**(既存を含む全部。実際の PostgreSQL と Redis。この Phase で3件増えた。上限を 1000 に上げたので、流し直しで当たらない)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイルとテスト 21本): 0 件。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`c4f8a2e6d1b9`)。dev の DB で `upgrade head` → `downgrade b8e4d0f2a6c3` → `upgrade head` の往復が通り、`google_sub` の一意のインデックス(`ix_users_google_sub`)と、`hashed_password` が null 可であることを確かめた。
- compose: `docker compose config` で、`docker-compose.yml` に test・e2e を重ねると4つの上限が 1000、e2e に `E2E_FAKE_GOOGLE` が入ること、`docker-compose.prod.yml` には入らないことを確かめた。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`)・`link_check.py`: 下の「検証の後の確かめ」。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 73](../Phase-73/Phase-73-introduction.md#未消化の申し送り37) から引き継いだもの。

ステージ10の最後の Phase(**Phase 79**)へ。本番への反映と一緒に確かめる。中身は Phase 72 のとおり。

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節(ステージ9)の手順を、ステージ10の分と1つにまとめる。確認の表はステージごとに分ける。結果と Anthropic の費用は Phase 79 に記録し、[72-2](../Phase-72/Phase-72-2.md) からもリンクする。ステージ10の分には、この Phase で次が増えた。
  - マイグレーション `c4f8a2e6d1b9`。ロールバックの前に `SELECT count(*) FROM users WHERE hashed_password IS NULL` が 0 件か確かめる(docstring と [内部設計書](../../docs/internal_design.md) 3.2節)。
  - 本番の `.env` の `GOOGLE_CLIENT_ID`(無ければ Google のログインだけが 503)。`E2E_FAKE_GOOGLE` は書かない(書くと起動しない)。
- **画面確認**(#37 の運用注記): Phase 62〜66・69 の画面確認(10.6節の表)を、Phase 79 で行う。Phase 76・77 の画面確認も足す。
- **origin の状態と手元の記録の食い違い**: devex-api の origin に `stage8` が無い。origin/main=`25974d9`、devex-ui の origin/main=`3c8369e`。反映のときに `git fetch` してから、出すコミットを確かめる。
- 画面確認で決めるもの:
  - **レビューを使えることの案内**(Phase 68 から)
  - **一覧の失敗の記録**(Phase 69 から)
  - **ダッシュボードの見出しの折り返し**(Phase 65 から)
- 操作感の確認で見るもの:
  - **アカウントのフォームの縦の余白**(Phase 66 から)。Phase 77 でアカウントの節を変えるときにも見る。
  - **閉じると保存していない編集が消える**(Phase 67 から)
- **Claude Haiku の推論のトークン**(Phase 68 から)・**値の欠けた答えを open に残す経路**(Phase 70 から): 本番での確認で見る。

ステージ10の後続の Phase へ:

- **Phase 75〜79 の未確定事項**: [73-3](../Phase-73/Phase-73-3.md)「未確定事項」(74 の分は解決)。
- **手元の確かめ用の OAuth クライアント**(→ ユーザー。Phase 76 の着手前): Google Cloud で、承認済みの JavaScript 生成元に `http://localhost:3000` を入れて作る。手順は Phase 76 の着手時に渡す。作ったら、devex-api の `.env` に `GOOGLE_CLIENT_ID`、devex-ui に `NEXT_PUBLIC_GOOGLE_CLIENT_ID` を入れる。
- **Google だけの利用者のマイページ**(この Phase から → Phase 75・77): 今は、今のパスワードを求める変更(メール・パスワード)が 400 になるだけ。Phase 75 でパスワードの「設定」を作り、Phase 77 で出し分ける。
- **画面の文言**(この Phase から → Phase 76): 409 `GOOGLE_LINK_REQUIRED`・`GOOGLE_ACCOUNT_CONFLICT`、400 `GOOGLE_EMAIL_NOT_VERIFIED`、502 `GOOGLE_VERIFY_FAILED` の画面の表示。API の `detail` は日本語の文にしたので、そのまま出してもよい。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。

この Phase で生まれたもの:

- **公開鍵の取得**: `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。ログインが増えて遅さが気になったら、`google.auth.transport.requests.Request` に `CacheControl` のセッションを渡してキャッシュする(今は入れない)。
- **ステージ9の振り返りと Phase 72〜74 の未コミット**: 3つのリポジトリの変更。コミットはユーザーが行う(#35)。
- **セッションの区切りの記録**: Phase 74 は1セッションで行った。計画モードで調査(エージェントは使わず直接。Context7 で `verify_oauth2_token` の例外を確かめた)→ 質問1回(4問)→ 計画の承認 → 74-1〜74-3 の実装 → 全体テストと integration → samples → docs → 教材。

この Phase で解決したもの:

- **73-3 の Phase 74 の未確定事項**(パスワードが違うときのコード・別の Google と連携済みのときの応答・偽の credential の形・`google_ip` の上限・上げる値): 着手時の相談と [74-3](./Phase-74-3.md)。
- **開発環境の登録・ログインの上限**(ステージ9 の申し送り。Phase 73 の決定11): [74-3](./Phase-74-3.md) の3節。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」にも追記した。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. Google だけの利用者のパスワードでのログインを、パスワードが違うときと同じ 401・同じ文言にしたのはなぜか。
2. 本人を `google_sub` で先に探し、見つからないときだけメールで探すのはなぜか。メールで見つかっても、すぐには紐付けないのはなぜか。
3. 公開鍵を取りに行けなかったときを 401 でなく 502 にしたのはなぜか。`TransportError` を `GoogleAuthError` より先に捕まえるのはなぜか。
4. 連携の確かめで、`google_ip` に加えて `enforce_login`(IP・メール)でも数えるのはなぜか。数えてから検証する順序にしたのはなぜか。
5. 開発用の上限を `docker-compose.yml` に書いても、本番に漏れないのはなぜか。test・e2e のオーバーレイには効くのはなぜか。

## 次のフェーズ

**Phase 75**: マイページの API。パスワードの設定(Google だけの利用者は今のパスワードを求めない)・メールの変更はパスワードが無ければ断る・マイページからの連携(`credential` を送る。ほかの人と連携済みの `sub` は 409)・連携の解除(パスワードが無ければ断る)。着手時に、自動実装モード(#21)と [73-3](../Phase-73/Phase-73-3.md) の Phase 75 の未確定事項(パスワードの設定を `PUT /users/me/password` に寄せるか・メールが違う Google を連携できるか・解除の後の refresh)を決める。この Phase の `GoogleAuthService` の連携済みの判定(`GOOGLE_ACCOUNT_CONFLICT`)を、マイページの連携でも使う。
