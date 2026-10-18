# Phase 75 導入: マイページの API(ステージ10)

## 目的

ステージ10の2つ目の実装 Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 75 として、マイページの Google まわりの API を作る([外部設計書](../../docs/external_design.md) 2.13節、[内部設計書](../../docs/internal_design.md) 3.3節 10項)。[Phase 74](../Phase-74/Phase-74-introduction.md) で Google でのログイン・登録はできたが、Google だけの利用者はマイページで何も変えられなかった(今のパスワードを求める変更が 400 になるだけ)。画面は Phase 77 で作る。

- パスワードの設定と、パスワードが無い人の断り ── [75-1](./Phase-75-1.md)
- マイページからの連携と解除 ── [75-2](./Phase-75-2.md)

## パイプライン上の位置づけ・前提

```
マイページ(Phase 77)── UserRead の has_password・google_linked で出し分ける(74-1)
   │
   ├ パスワードが無い人
   │    POST /users/me/password {new_password}                                 ──[75-1]
   │      ある人は 409 PASSWORD_ALREADY_SET。ほかの端末を切って今の端末に出し直す
   │    PUT /users/me/email・PUT /users/me/password → 409 PASSWORD_NOT_SET       ──[75-1]
   │    DELETE /users/me/google → 409 PASSWORD_NOT_SET                          ──[75-2]
   │
   └ パスワードがある人
        POST /users/me/google {credential, current_password}                   ──[75-2]
          google_ip → 検証(74-2)→ enforce_login(IP・今のメール)
          → GoogleAuthService.link_current
               ├ email_verified が false → 400
               ├ 今のパスワードが違う → 400 CURRENT_PASSWORD_MISMATCH
               └ _attach(74-3 の link と共有): 同じ Google は成功 / ほかと連携済みは 409
          → UserRead(端末は切らない)
        DELETE /users/me/google → google_sub を消す → ほかの端末を切って出し直す    ──[75-2]
```

- **前提として読むもの**: [73-1](../Phase-73/Phase-73-1.md) の決定7(Google だけの利用者のマイページ)・[73-3](../Phase-73/Phase-73-3.md)(Phase 75 のスコープと未確定事項)・[74-3](../Phase-74/Phase-74-3.md)(`GoogleAuthService`・`GoogleTokenVerifierDep`・`google_ip`)・[外部設計書](../../docs/external_design.md) 2.13節・[内部設計書](../../docs/internal_design.md) 3.3節 10項。
- **今の仕組み**: マイページのアカウントの API は Phase 66 の3つ(`PATCH /users/me`・`PUT /users/me/email`・`PUT /users/me/password`)。メール・パスワードの変更は今のパスワードで確かめ(不一致は 400)、試行は `enforce_login` で数える。パスワードの変更は、その人の refresh を全部失効させて今の端末に出し直す。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `05cc8a5`(Phase 74)、外側のリポジトリは `0849cf8`。どちらも未コミットの変更は無かった。devex-ui は `c11673a` のままで、`e2e/stage9-flow.spec.ts` が未追跡(この Phase では触らない)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(画面を変えないため。ステージ10の E2E は Phase 79 で既存を含めて全部流す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 75 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | パスワードの設定の API | 別の API `POST /users/me/password {new_password}`。ほかの端末を切る(推奨どおり) |
| 3 | マイページの連携の条件 | `{credential, current_password}`。メールが違う Google も可(推奨どおり) |
| 4 | 解除の後の refresh | ほかの端末を切る(推奨どおり) |

Claude の判断(計画の承認で確定):

- 新しい例外2つはどちらも 409(`PASSWORD_ALREADY_SET`・`PASSWORD_NOT_SET`)。パスワードが無い人のメール・パスワードの変更は、74-1 の 400 `CURRENT_PASSWORD_MISMATCH` から 409 `PASSWORD_NOT_SET` に変えた。
- 設定はログインの上限で数えない(当てる今のパスワードが無い)。
- マイページの連携は `google_ip` → 検証 → `enforce_login`(IP と今のメール)。今のパスワードの不一致は 400(ログイン中の操作)。メールを使わなくても `email_verified=false` は断る。応答は `UserRead`(端末は切らない)。
- 解除は今のパスワードを求めない。連携していなくても成功。応答は `AccessToken`。
- 連携済みの判定と記録は `_attach` に移し、74-3 の `link` と共有(#17)。失効と出し直しは `_reissue_tokens` に寄せ、変更・設定・解除で共有。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-75-1.md`](./Phase-75-1.md) | パスワードの設定と、パスワードが無い人の断り | あり(本体 4 + テスト 2) | なし(74 の列) |
| [`Phase-75-2.md`](./Phase-75-2.md) | マイページからの連携と解除 | あり(本体 3 + テスト 2) | 75-1(`require_password`・`PasswordNotSetError`・`_reissue_tokens`) |

## サンプルコード一覧

`textbook/samples/backend/` の新規・更新:

- 75-1: `app/services/errors.py`・`app/schemas/user.py`・`app/services/user.py`・`app/api/routes/users.py`・`tests/unit/test_user_google_columns.py`・`tests/unit/test_password_set.py`(新規)
- 75-2: `app/schemas/user.py`・`app/services/google_auth.py`・`app/api/routes/users.py`・`tests/unit/test_google_link_mypage.py`(新規)・`tests/integration/test_google_mypage_flow.py`(新規)
- ミラーしないもの(#21 の共通): `devex-api/CLAUDE.md`(レート制限の節に、マイページの連携の数え方を1文足した)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [75-1](./Phase-75-1.md) | 2つの例外・`PasswordSet`・`set_password`・`require_password`・`POST /users/me/password`・`_reissue_tokens` | パスワードが無い人に設定させ、今のパスワードが要る変更は理由を分けて断る | 設定と 409 の2つ・連携が残る・ほかの端末が切れる・規則・変更の断り |
| [75-2](./Phase-75-2.md) | `GoogleLinkCurrentRequest`・`link_current`・`unlink`・`_attach`・`POST`/`DELETE /users/me/google` | ログイン中の本人を、今のパスワードで確かめてから Google と結び、解除ではほかの端末を切る | メールが違う連携・400・409 の2つ・やり直し・解除の冪等・上限(検証を呼ばない)・実際の DB での流れ |

## 写経順序(#23)

章番号順(75-1 → 75-2)。各章の表の順(依存順。#30)に写す。マイグレーション・依存の追加・compose の変更は無い。

実 import 監査(#15。全 import 文を読んで確かめた):

- 75-1: `services/user.py` → `PasswordAlreadySetError`・`PasswordNotSetError`(この章の `errors.py`。表で先に置く)。`routes/users.py` → `User`(既存)・`PasswordSet`(この章の `schemas/user.py`)。テスト → `set_password`(ルート)・`decode_token`・`verify_password`・`User`・`UserRepository`・`PasswordSet`・`AuthService`・2つの例外・`UserService`・`require_password`・`FakeRedis`(この章と既存)。`test_user_google_columns.py` → `PasswordNotSetError`(この章)。
- 75-2: `google_auth.py` → `CurrentPasswordMismatchError`(Phase 66)・`require_password`(75-1)。`routes/users.py` → `GoogleTokenVerifierDep`(74-3)・`GoogleLinkCurrentRequest`(この章の `schemas/user.py`)・`GoogleAuthService`(74-3。`link_current`・`unlink` はこの章の表で上)。テスト → `link_google`・`unlink_google`・`settings`・`decode_token`・`User`・`UserRepository`・`GoogleLinkCurrentRequest`・`AuthService`・例外(`PasswordNotSetError` は 75-1、ほかは既存)・`GoogleAuthService`・`GoogleIdentity`・`UserService`・`FakeGoogleVerifier`(74-3)・`FakeRedis`。integration → `get_client_ip`・`AsyncSessionLocal`・`hash_password`・`app`・`User`・`FakeGoogleTokenVerifier`・`get_google_token_verifier`(既存・74-2)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: 75-1 は設定・アカウント・Google の列・ユーザーのテスト(28件)、75-2 は Google の連携(マイページとログイン)と設定のテスト(41件)。すべて成功。新しいテストは unit 22件(8・14)と integration 3件。
- Phase 完了時の全体テスト(#18): devex-api **1494 件成功**(25 件は integration で除外)。integration **25 件成功**(既存を含む全部。実際の PostgreSQL と Redis)。devex-ui は変えていないので流していない。
- `ruff check`(app・tests)成功(`ruff format` は使わない)。`uvx pyright`(変えたファイルとテスト 9本): 0 件。
- マイグレーション: 無し(列は Phase 74 で足した)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 787 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は、以前からの `change-impact-demo` のルート(Phase 72 と同じ)。`link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 74](../Phase-74/Phase-74-introduction.md#未消化の申し送り37) から引き継いだもの。

ステージ10の最後の Phase(**Phase 79**)へ。本番への反映と一緒に確かめる。中身は Phase 72 のとおり。

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節(ステージ9)の手順を、ステージ10の分と1つにまとめる。確認の表はステージごとに分ける。結果と Anthropic の費用は Phase 79 に記録し、[72-2](../Phase-72/Phase-72-2.md) からもリンクする。ステージ10の分には、Phase 74 で次が増えた(この Phase ではマイグレーション・設定は増えていない)。
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

- **Phase 76〜79 の未確定事項**: [73-3](../Phase-73/Phase-73-3.md)「未確定事項」(74・75 の分は解決)。
- **手元の確かめ用の OAuth クライアント**(→ ユーザー。Phase 76 の着手前): Google Cloud で、承認済みの JavaScript 生成元に `http://localhost:3000` を入れて作る。手順は Phase 76 の着手時に渡す。作ったら、devex-api の `.env` に `GOOGLE_CLIENT_ID`、devex-ui に `NEXT_PUBLIC_GOOGLE_CLIENT_ID` を入れる。
- **画面の文言**(Phase 74 から → Phase 76): 409 `GOOGLE_LINK_REQUIRED`・`GOOGLE_ACCOUNT_CONFLICT`、400 `GOOGLE_EMAIL_NOT_VERIFIED`、502 `GOOGLE_VERIFY_FAILED` の画面の表示。API の `detail` は日本語の文にしたので、そのまま出してもよい。
- **マイページの画面**(この Phase から → Phase 77): 出し分けは `has_password`・`google_linked` で。
  - パスワードが無い人: パスワードの「設定」(`POST /users/me/password`。応答は `AccessToken` で、変更と同じく今の端末のトークンを入れ替える)。メールの変更と解除は出さない。
  - パスワードがある人の連携: Google のボタンの credential と、今のパスワードを送る(`POST /users/me/google`。ボタンの後にパスワードを聞くか、先に聞くかは 77 で決める)。応答は `UserRead`。400 `CURRENT_PASSWORD_MISMATCH`・409 `GOOGLE_ACCOUNT_CONFLICT`・400 `GOOGLE_EMAIL_NOT_VERIFIED` の文言。
  - 解除: `DELETE /users/me/google`。応答は `AccessToken`(今の端末のトークンを入れ替える)。ほかの端末が切れることを確認のダイアログで伝えるか、77 で決める。
  - 409 `PASSWORD_NOT_SET`・`PASSWORD_ALREADY_SET` は、出し分けが正しければ画面からは来ない(古い画面の状態のときだけ)。`detail` をそのまま出してよい。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **公開鍵の取得**(Phase 74 から): `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。ログインが増えて遅さが気になったら、`google.auth.transport.requests.Request` に `CacheControl` のセッションを渡してキャッシュする(今は入れない)。

この Phase で生まれたもの:

- **Phase 75 の未コミット**: 外側のリポジトリと devex-api の変更。コミットはユーザーが行う(#35)。
- **devex-ui の未追跡のファイル**: `e2e/stage9-flow.spec.ts`(ステージ9の E2E)。コミットするか、Phase 79 の E2E の前に確かめる(#35)。
- **セッションの区切りの記録**: Phase 75 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問1回(4問)→ 計画の承認 → 75-1・75-2 の実装 → 全体テストと integration → samples(`tagmerge.py` が、移した行を「追記」と読み違えたので、`change_password` のルートと `link` の更新のタグを手で直した)→ docs → 教材。

この Phase で解決したもの:

- **73-3 の Phase 75 の未確定事項**(パスワードの設定の API・メールが違う Google の連携・解除の後の refresh): 着手時の相談と [75-1](./Phase-75-1.md)・[75-2](./Phase-75-2.md)。
- **Google だけの利用者のマイページ**(Phase 74 から。API の分): [75-1](./Phase-75-1.md)。画面の分は Phase 77 へ(上の「マイページの画面」)。
- **ステージ9の振り返りと Phase 72〜74 の未コミット**(Phase 74 から): 開始時点で devex-api(`05cc8a5`)と外側(`0849cf8`)はコミット済みだった。devex-ui の未追跡の `e2e/stage9-flow.spec.ts` は下の「この Phase で生まれたもの」へ。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. パスワードの設定を `PUT /users/me/password` に寄せず、別の API(`POST`)にしたのはなぜか。設定がログインの上限で数えないのはなぜか。
2. Google だけの人のメールの変更を、400 `CURRENT_PASSWORD_MISMATCH` から 409 `PASSWORD_NOT_SET` に変えたのはなぜか。
3. マイページの連携で今のパスワードを求めるのはなぜか。ログインの画面からの連携の確かめ(74-3)と違って、メールが違う Google を許せるのはなぜか。
4. 連携では端末を切らず、解除ではほかの端末を切るのはなぜか。
5. 連携済みの判定を `_attach` に移したのは、#17 のどの問いに答えられたからか。
