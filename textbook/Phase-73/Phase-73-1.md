# Phase-73-1: スコープの確認と仕様診断(#28)・決定・ステージ10の入力の判断

## この章の目的

ステージ10(Google 認証)の構想([ロードマップ](../../appendix/devex_roadmap.md) ステージ10)と影響調査([`stage9-10-plan.md`](../../appendix/stage9-10-plan.md) 2節)を出発点に、未決の点を診断し、ユーザーに決めてもらう。あわせて、[Phase 72 の「未消化の申し送り」](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)にある「ステージ10の入力」5件を1件ずつ判断する。

自動実装モード: on([introduction](./Phase-73-introduction.md) 参照)。

## この章で作成・更新したファイル

なし(本体・samples の変更は無い)。決定は [73-2](./Phase-73-2.md) で `docs/*.md` に反映した。

## スコープ(構想から)

[`stage9-10-plan.md`](../../appendix/stage9-10-plan.md) 2.1節の影響調査は、次の4つの領域に分かれる。

- **API**: `users` の変更(Google の識別子・パスワードを null 可に)と、`POST /auth/google`(ID トークンを検証し、自前の JWT と refresh cookie を出す)。
- **UI**: ログインと登録の画面のボタン、マイページの出し分け。
- **本番**: Google Cloud の OAuth クライアント。
- **E2E**: 偽の検証。

2.3節の未決事項は3つあった。フローの形、同じメールの既存アカウントとの紐付け、ライブラリである。この章はこの3つから始めた。

## 調べたこと(推奨の根拠)

- **今の認証**(`devex-api/backend/app/api/routes/auth.py`):
  - ログインは、アクセストークンを本文で返し、refresh を httpOnly cookie(API のオリジン、`path=/api/v1/auth`。`app/api/refresh_cookie.py` の `set_refresh_cookie`)に置く。
  - UI(Vercel)と API(VPS)はオリジンが違う。
  - 登録ではメールを確かめない。メールの変更も、今のパスワードで確かめて即時に変える(Phase 66)。
- **`users`**(`app/models/user.py`):
  - `hashed_password` は NOT NULL。照合する場所は `AuthService.authenticate` と、`UserService` のパスワード・メールの変更の2か所。
- **レート制限**(`app/services/auth_rate_limit.py`):
  - カウンタは `login_ip`(30回/時)・`login_email`(20回/時)・`register_ip`(10回/時)の3つ。
  - 本番で弾く設定(`app/core/config.py` の production のバリデータ)には `E2E_FAKE_LLM` などが入っている。
- **ライブラリ**:
  - `google-auth` は依存の依存で 2.56.3 が入っている(`google-genai` から)。Context7 で `id_token.verify_oauth2_token(token, request, audience)` を確かめた。署名・`iss`・`aud`・`exp` をまとめて確かめ、失敗すると `ValueError` を出す。同期の処理である。
  - UI 側の `@react-oauth/google` は 0.13.5(2026-04 に更新、peer は `react>=16.8`)。`GoogleOAuthProvider` と `GoogleLogin` が credential(ID トークン)を返す(Context7 で確かめた)。

## 診断と決定

診断は #28 の3段階で示した。計画モードで2回(5問。うち2問は理由の説明を求められて聞き直した)、計画の承認の後に2回(8問)質問した。**すべて推奨どおり**に決まった。

### 最重要(次の Phase のタスクに直結する)

| # | 論点 | 選択肢(推奨は先頭) | ユーザーの決定 |
|---|---|---|---|
| 1 | フロー | **ID トークン(Google Identity Services)**/ Authorization Code | 推奨どおり |
| 2 | 同じメールの既存アカウント(パスワードで登録済み) | **確かめずには紐付けない** / `email_verified` なら自動で紐付ける / 自動で紐付けてパスワードを消す | 推奨どおり。ただし、ユーザーの希望(既存のプロジェクトを引き継ぎ、紐付けた後は Google とメールのどちらでもログインできる)を受けて、確かめ方を問い直した(決定3) |
| 3 | 紐付けの確かめ方 | **Google でログインしたときに、パスワードで確かめる**(最初の1度だけ。マイページからの連携も作る)/ マイページからの連携だけ / `email_verified` なら自動で | 推奨どおり |
| 4 | 連携の確かめの API の形 | **ID トークンをもう一度送る**(`/auth/google` は 409 `GOOGLE_LINK_REQUIRED` を返すだけ。UI は credential を保ったままパスワードを聞き、`POST /auth/google/link {credential, password}`)/ 連携のチケット(Redis。寿命10分・1回きり) | 推奨どおり |
| 5 | `email_verified` が false の ID トークン | **断る**(400)/ 新規の登録だけ許す | 推奨どおり |
| 6 | 検証のライブラリ | **`google-auth`**(明示の依存にする。threadpool で呼ぶ)/ pyjwt の `PyJWKClient` | 推奨どおり |

#### 決定1の理由(ユーザーに説明したこと)

- ID トークンの形なら、画面の Google ボタンが返す ID トークン(Google が署名した JWT)を `POST /auth/google` に送るだけで済む。**今の `/auth/login` と同じ返し方**(access を本文、refresh を cookie)にそのまま乗る。
- Authorization Code の形では、Google から API のコールバックへリダイレクトし、API が **client secret** でコードを交換する。その後で UI に戻し、UI が access を取り直す(`/auth/refresh`)。そのため、state・PKCE の管理、secret の保管、2つのオリジンをまたいで戻る処理が増える。
- Google の API(Drive など)は呼ばない。要るのは「誰か」の確認だけなので、アクセストークンをもらうフローを選ぶ利点が無い。

#### 決定2・3の理由(乗っ取りの準備 ── pre-hijacking)

- このアプリは登録のときにメールを確かめない。そのため、**他人が先にあなたのメールアドレスでパスワード登録しておける**。
- その後であなたが Google でログインし、自動で紐付けたとする。アカウントはあなたのものになるが、先に登録した人は自分のパスワードで入り続けられる。
- 「自動で紐付けてパスワードを消す」案なら、この問題は防げる。ただし、紐付けた後にメールでログインするには、パスワードを1度設定し直す必要がある(Google でログインするたびに、ではない)。この点でユーザーの希望に合わなかった。
- 決定3では、紐付けのときに**両方を知っている本人だけ**が通れる。パスワードは、先に登録した人が持っていれば、その人にしか分からないからである。そのため乗っ取りは防げる。紐付けた後は両方の方法が使え、プロジェクトもそのまま残る。

### 中程度(後続 Phase の設計事項)

| # | 論点 | 選択肢(推奨は先頭) | ユーザーの決定 |
|---|---|---|---|
| 7 | Google だけで登録したユーザーのマイページ | **パスワードの「設定」を出す**(今のパスワードは求めない。メールの変更は今のパスワードが要るので、設定するまで出さない。連携の解除は、パスワードがあるときだけ許す)/ パスワードを持たせない | 推奨どおり |
| 8 | UI のボタン | **`@react-oauth/google`** / GIS のスクリプトを直接読む | 推奨どおり |
| 9 | E2E の偽の検証 | **`E2E_FAKE_GOOGLE` を新しく作る**(偽の credential を受け付ける。`E2E_FAKE_LLM` と同じく production では起動時に弾く)/ `E2E_FAKE_LLM` に相乗りする | 推奨どおり |
| 10 | 手元の確かめ用の OAuth クライアント(承認済みの JavaScript 生成元 `http://localhost:3000`) | **UI の Phase の前にユーザーが作る**(API の Phase は偽の検証と単体テストで進める)/ 今作る / 手元では作らない | 推奨どおり |

### 軽微・運用面(ステージ10の入力の判断)

| # | ステージ10の入力 | 判断 | 入れる Phase |
|---|---|---|---|
| 11 | 開発環境の登録・ログインの上限(ステージ9 で5回当たった) | **入れる。開発用の compose(dev・test・e2e)の env で上限を上げる**(推奨どおり。本番は今の値のまま。コードは変えない。integration・E2E・実 LLM の確かめのスクリプトのどれにも効く)。Google のログインは新しいカウンタ `google_ip` で数える | 74 |
| 12 | 削除したプロジェクトの URL を開いたときの表示(Phase 64 から) | 入れる | 78 |
| 13 | 新規作成の後の一覧の cache(Phase 65 から) | 入れる | 78 |
| 14 | 押せないボタンの見た目(Phase 69 から) | 入れる | 78 |
| 15 | 負荷のときだけ落ちるテスト(チャットの履歴の並び) | 入れる | 78 |

12〜15 は、どれも小さな変更である。ユーザーは4件すべてを選んだ(推奨は「1つの Phase にまとめる」案)。

### Claude の判断(計画の承認で確定、または診断中)

- **`users` の変更**: Alembic を1本足す(Phase 74)。
  - `hashed_password` を null 可にする。
  - `google_sub`(VARCHAR(255)・一意・null 可)を足す。
  - ステージ9のロールバックと同じ注意が要る。Google だけのユーザーがいると、downgrade で NOT NULL に戻せない。そのため、ロールバックの手順の前に、パスワードが null の行の数を確かめる(Phase 79 の `OPERATIONS.md`)。
- **探す順は `google_sub` が先**。
  - ID トークンの `sub` に一致する行があれば、その人としてログインする。Google 側のメールが後で変わっても、アプリのメールは変えない。
  - 一致が無ければ、メールで探す。見つかり、まだ連携していなければ、409 `GOOGLE_LINK_REQUIRED`(決定4)。
  - 見つかった人がほかの Google アカウントと連携済みなら、紐付けずに断る。
  - どちらにも無ければ、新しく登録する。メールは ID トークンのもの、`user_name` は `name` の claim、superuser ではない。
- **Google だけのユーザーのパスワードでのログイン**: パスワードが違うときと同じ 401 にする。`authenticate` で null を照合しない。どのアカウントが Google だけかを外から見分けさせないため。
- **連携の確かめのパスワードの試行**: ログインと同じ `AuthRateLimiter.enforce_login`(IP とメール)で数える。`/auth/google`・`/auth/google/link` の呼び出しは、新しいカウンタ `google_ip` でも数える。
- **設定の値**:
  - API は `GOOGLE_CLIENT_ID`(ID トークンの `aud` の確かめに使う)。UI は `NEXT_PUBLIC_GOOGLE_CLIENT_ID`。
  - API に値が無いときは、`/auth/google` を 503 で断る。UI は値が無ければボタンを出さない(`ENCRYPTION_KEY` が無いときと同じ考え方。Google の設定が無くても、今のログインはそのまま使える)。
- **`GET /users/me` に足す項目**: `has_password`・`google_linked`。マイページの出し分け(決定7)と、ログインの画面の案内に使う。
- **ログインの印の cookie**: Google でログインしたときも `auth-store` の `login()` を通す。印(Phase 63)は今と同じ場所で付く。
- **`google-auth` の呼び方**: `requests` のトランスポートを使うので、`run_in_threadpool` で呼ぶ。証明書は呼ぶたびに取りに行くが、ログインは頻繁ではないので許す。
- **compose の上限**(決定11): 本番は `docker compose -f docker-compose.prod.yml` だけで起動する(`OPERATIONS.md` の手順)。`docker-compose.yml` の env を引き継がないので、開発用の値は本番に漏れない(診断中に確かめた)。

## Phase 72 の申し送りの扱い

| 区分 | 扱い |
|---|---|
| ステージ10の最後の Phase へ(本番への反映と本番での確認・画面確認・origin の食い違い・レビューの案内・一覧の失敗の記録・見出しの折り返し・アカウントのフォームの余白・閉じると消える編集・Haiku の推論のトークン・値の欠けた答え) | そのまま **Phase 79** へ([73-3](./Phase-73-3.md))。あわせて、ステージ10の分の手順を `OPERATIONS.md` で1つにまとめる |
| ステージ10の入力(5件) | すべて入れた(上の表の 11〜15) |
| 生成の質の候補(4件) | ステージ10の範囲の外。そのまま持ち越す |
| 持ち越し(小さな持ち越し3件・カタログの見直し) | そのまま持ち越す |

## テスト観点

この章は実装ファイルを作らない(仕様診断の記録)。#13・#14・#15 の対象外。
