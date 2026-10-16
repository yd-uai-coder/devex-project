# Phase 66 導入: マイページのアカウント(ステージ9)

## 目的

ステージ9の5つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 66 として、マイページ(SCR-009)を新設し、ユーザーネーム・メールアドレス・パスワードを本人が変えられるようにする([外部設計書](../../docs/external_design.md) 2.12節)。用途ごとのモデルと API キーは Phase 67 で同じページに足す。

- 表示名の列を `full_name` から `user_name` に改名する ── [66-1](./Phase-66-1.md)
- ユーザーネーム・メール・パスワードを変える API を作る ── [66-2](./Phase-66-2.md)
- `/mypage` とメニューの項目、3つのフォームを置く ── [66-3](./Phase-66-3.md)

## パイプライン上の位置づけ・前提

```
メニュー CONTENTS「マイページ」──► /mypage(RequireAuth)──[66-3]
   └ AccountSection ── GET /users/me
        ├ UserNameForm ── PATCH /users/me {user_name}                         ──[66-2]
        ├ EmailForm    ── PUT /users/me/email {new_email, current_password}
        │                   └ 不一致 400 CURRENT_PASSWORD_MISMATCH / 使われている 409
        └ PasswordForm ── PUT /users/me/password {current_password, new_password}
                            ├ 規則(password_policy)に外れれば 422
                            ├ ハッシュを替える → refresh_token:{user_id}:* を全部消す(ほかの端末を切る)
                            └ 今の端末に access(本文)+ refresh(Cookie)を出し直す → auth-store.login(access)

users.full_name ──[66-1 Alembic の改名]──► users.user_name(登録・seed・E2E の欄も「ユーザーネーム」)
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 66 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節「マイページ(SCR-009)」、[内部設計書](../../docs/internal_design.md) 3.3節「9. 使い勝手とアカウント・モデル設定」の「アカウント」。
- **今の仕組み**: ログインはメールとパスワードで、access(30分)は本文、refresh は httpOnly の Cookie で出す。refresh は Redis に `refresh_token:{user_id}:{jti}` の鍵で1つずつ持ち、ログアウトはその1つを消す。パスワードの規則(大文字・小文字・数字・記号)は登録の画面の zod にだけあり、API は下限を持たない。`GET /users/me` は Phase 52 から設計レビューの設定にも使っている。
- **この Phase を始めた時点の状態**: devex-api の HEAD は `0da8c02`、devex-ui は `5269927`(Phase 65)。外側のリポジトリは Phase 65 までコミット済み(`3475395`)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部流す)。改名で登録の欄が「ユーザーネーム」になったので、`e2e/helpers.ts` の `registerAndLogin` を合わせて直した([66-1](./Phase-66-1.md))。画面の流れは、Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 66 開始時」を参照。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 変更の API の形 | 3つに分ける(`PATCH /users/me`・`PUT /users/me/email`・`PUT /users/me/password`)(推奨どおり) |
| 3 | パスワードの変更の後、今の端末のログイン | 保つ(全部を失効させてから、今の端末に出し直す)(推奨どおり) |
| 4 | 新しいパスワードの規則の置き場 | 画面と変更の API(登録の API は今のまま)(推奨どおり) |

Claude の判断(計画の承認で確定、または作業中):

- 今のパスワードの不一致は 400 `CURRENT_PASSWORD_MISMATCH`(401 は画面がログアウトに倒すため)。今のパスワードの試行は、ログインと同じ上限で数える。
- メールの重複は既存の 409。今と同じメールへの変更は成功として扱う。
- 登録画面の「氏名」は「ユーザーネーム」に改め、E2E の `helpers.ts` も直す。
- Cookie の付け外しを `app/api/refresh_cookie.py` に移し、ログインとパスワードの変更で共有する。
- **作業中**: API の規則の文言を画面と同じにした(「パスワードは8〜128文字で入力してください」「…は大文字を含めてください」)。記号は画面の `SYMBOL_PATTERN` と同じ ASCII の記号に揃えた(全角の記号は数えない)。
- **作業中**: パスワードのフォームに「新しいパスワード(確認)」の欄を置いた(打ち間違いで入れなくなるのを防ぐ。画面だけで照らす)。
- **作業中**: テンプレートの `UserUpdate`(使われていなかった更新用スキーマ)を、操作ごとのスキーマに分けたので消した。
- **作業中**: 統合テストで接続元の IP を差し替えた(`get_client_ip`)。今のパスワードの試行をログインの上限で数えるので、実行を重ねると IP ごとの上限に当たるため。

推奨と違った選択は無し。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-66-1.md`](./Phase-66-1.md) | 表示名の列の改名(`full_name` → `user_name`) | あり(本体 6 + マイグレーション 1 + 画面 3 + テスト 4) | なし |
| [`Phase-66-2.md`](./Phase-66-2.md) | アカウントの API | あり(本体 8 + フィクスチャ 1 + テスト 4) | 66-1(`user_name`) |
| [`Phase-66-3.md`](./Phase-66-3.md) | マイページの画面 | あり(本体 9 + テスト 6) | 66-2(API) |

## サンプルコード一覧

`textbook/samples/backend/`・`textbook/samples/frontend/` の新規・更新:

- 66-1: `alembic/versions/4b7e2d9c1a6f_rename_full_name_to_user_name.py`(新規)・`app/models/user.py`・`app/schemas/user.py`・`app/repositories/user.py`(テンプレート由来。samples に初めて載せた)・`app/services/user.py`・`app/api/routes/auth.py`・`scripts/seed.py`・`tests/unit/test_user_rename.py`(新規)・`tests/integration/test_auth_flow.py`・`tests/integration/test_projects_flow.py`・`src/features/auth/schemas.ts`・`src/features/auth/components/RegisterForm.tsx` とテスト・`e2e/helpers.ts`
- 66-2: `app/core/password_policy.py`(新規)・`app/schemas/user.py`・`app/services/errors.py`・`app/services/user.py`・`app/services/auth.py`(テンプレート由来。samples に初めて載せた)・`app/api/refresh_cookie.py`(新規)・`app/api/routes/auth.py`・`app/api/routes/users.py`・`tests/fixtures/fake_redis.py`・`tests/unit/test_password_policy.py`(新規)・`tests/unit/test_account.py`(新規)・`tests/unit/test_generic_chat_and_refresh.py`・`tests/integration/test_account_flow.py`(新規)
- 66-3: `src/lib/menu-tree.ts`・`src/features/auth/schemas.ts`・`src/features/mypage/`(新規。`api/accountApi.ts`・`schemas.ts`・`components/` の4つ)・`src/app/mypage/page.tsx`(新規)とテスト6つ(`menu-tree.test.ts` 以外は新規)
- ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [66-1](./Phase-66-1.md) | マイグレーション・`User`・スキーマ・登録・seed・登録の画面 | 表示名の列と項目の名前を `user_name` に揃える(値は残す) | 登録で渡した名前が `user_name` に入り応答に出る・seed の利用者・画面の欄と本文・マイグレーションの往復 |
| [66-2](./Phase-66-2.md) | `password_policy`・3つのスキーマ・`UserService` の変更・`revoke_all_refresh_tokens`・`refresh_cookie`・3つのルート | 本人を確かめて変える / パスワードの変更でほかの端末を切り、今の端末に出し直す | 400・409・422 の分け方・同じメール・試行の上限・その人の鍵だけを消す・ほかの端末の refresh が 401 で今の端末は通る・不一致では切らない |
| [66-3](./Phase-66-3.md) | `MENU_TREE`・`newPasswordSchema`・`accountApi`・3つのフォーム・`AccountSection`・ページ | 今の値を読み、3つを別々に保存する / パスワードの変更の後にトークンを入れ直す | 欄のエラー(400・409・確認の不一致)・成功のトースト・ストアの入れ直し・未ログインでは読まない・メニューの項目 |

## 写経順序(#23)

章番号順(66-1 → 66-2 → 66-3)。各章の表の順(依存順。#30)に写す。

- 66-1 のマイグレーションを写したら、`alembic upgrade head` を流してから API を動かす(ORM の列が `user_name` になるため、古い DB のままでは `GET /users/me` が失敗する)。
- 66-1 だけを写した時点では、画面の登録は `user_name` を送り、API も `user_name` を受けるので、登録・ログインは通る。

実 import 監査(#15。全 import 文を読んで確かめた):

- 66-1: 新しい import は無い(名前の変更だけ)。`test_user_rename.py` → `scripts.seed`・`tests.fixtures.fake_redis.FakeRedis`・`app.api.routes.auth.register`・`UserRepository`・`UserCreate`・`UserRead`・`UserService`(すべて既存)。
- 66-2: `schemas/user.py` → `typing.Annotated`・`pydantic.StringConstraints`・`pydantic.field_validator`(外部)・`password_violations`(66-2 の `password_policy.py`。表で先に置く)。`services/user.py` → `verify_password`(既存)・`CurrentPasswordMismatchError`(66-2 の `errors.py`。表で先に置く)。`api/refresh_cookie.py` → `REFRESH_TOKEN_COOKIE_NAME`・`settings`(既存)。`routes/auth.py` → `refresh_cookie`(66-2。表で先に置く)。`routes/users.py` → `fastapi.Response`・`ClientIpDep`・`RedisDep`・`AccessToken`・`AuthService`・`AuthRateLimiter`(既存)・`refresh_cookie`・`EmailUpdate`・`PasswordUpdate`・`UserNameUpdate`(66-2)。`fake_redis.py` → `collections.abc.AsyncIterator`・`fnmatch.fnmatchcase`(標準)。テスト → この章のもの(`change_email` など)と既存。
- 66-3: `schemas.ts`(auth)→ 新しい import は無い。`accountApi.ts` → `apiFetch`・`AccessTokenResponse`(既存)。`mypage/schemas.ts` → `EMAIL_MAX_LENGTH`・`USER_NAME_MAX_LENGTH`・`newPasswordSchema`(66-3 で export。表で先に置く)・`validation-rules`(既存)。フォーム → `FormGeneral`・`InputSimpleText`・`InputEmail`・`InputPassword`・`useToastController`・`useAuthStore`・`ApiError`(既存)と 66-3 の `accountApi`・`schemas`。`AccountSection.tsx` → 3つのフォーム(66-3。表で先に置く)。ページ → `RequireAuth`(既存)・`AccountSection`(66-3)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する(マイグレーションは往復の実行で確かめた)。

## 検証結果

- 章ごとの部分テスト: devex-api は 66-1・66-2 のテストと、変えたテスト(認証・seed・Cookie の寿命。41件)。devex-ui は認証・マイページ・メニュー(31件)。すべて成功。
- Phase 完了時の全体テスト(#18): devex-api **1321 件成功**(16 件は integration で除外)。integration **16 件成功**(既存を含む全部。実際の PostgreSQL。この Phase で2件増えた。1度目は今日の実行の積み重ねで登録の上限に当たり、既存の `test_projects_flow.py` の3件が落ちた。カウンタが切れてから流し直した)。devex-ui **988 件成功**(151 ファイル。`--maxWorkers=4`)。
- `ruff check`・`pyright`(変えたファイルとテスト)・`tsc --noEmit` 成功。`npm run lint`: エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- マイグレーション: リビジョン ID の衝突なし・head は1つ(`4b7e2d9c1a6f`)。dev の DB で `upgrade head` → `downgrade 8d4f1a2b6c3e` → `upgrade head` の往復が通り、列が `user_name` になった。
- ブラウザでの確認(Playwright のスクリプト。dev の UI と API):
  - 登録の画面で「ユーザーネーム」の欄から登録できる。トップページに `/mypage` へのリンクが出る。
  - マイページで今のユーザーネームが入っていて、変えるとトースト「ユーザーネームを変えました」。
  - メールの変更で今のパスワードを間違えると、今のパスワードの欄に「今のパスワードが正しくありません」。正しく入れると「今のメールアドレス」が新しいメールに替わる。
  - 新しいパスワードが規則に外れると「新しいパスワードは大文字を含めてください」(API を呼ばない)。規則どおりに変えるとトースト「パスワードを変えました」。
  - 変えた端末は読み込み直してもログインのまま(ユーザーネームも変えた値)。先にログインしておいた別の端末(ブラウザのコンテキスト)は、マイページを開くとアカウントの節が出ない(refresh が 401)。
  - 新しいメールと新しいパスワードで、別のコンテキストからログインできる。
  - 幅 375px ではみ出さない(`scrollWidth` 375)。幅 1280px で崩れない。
  - コンソールのエラー: 401(ログイン前の refresh の既存の応答と、切った端末の refresh)と 400(わざと間違えた今のパスワード)だけ。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 作り忘れ 0 件。不一致 1 件は Phase 65 から残る `ProjectListControls.tsx`(下の「未消化の申し送り」)。この Phase のファイルはすべて一致(一致 723 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

Phase 65 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 67〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase も devex-ui は `--maxWorkers=4` で流した)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 67〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62〜66 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **確認メールの送信**: 範囲の外。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)・認証ページの振り分け(Phase 63)・削除のボタン・ダイアログ・トースト(Phase 64)・検索・絞込み・ページ送り(Phase 65)・マイページのアカウント(この Phase)は、Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。マイページは Phase 67 でモデルと API キーの節が足された後、操作感をユーザーが確かめる([61-3](../Phase-61/Phase-61-3.md))。
- **登録の上限と手元の確認**: 既存の `test_auth_flow.py`・`test_projects_flow.py` は API で登録するので、integration を流し直すと登録・ログインの上限(10回/時)に当たる。この Phase でも、1度目の全体の integration は今日の実行の積み重ねで登録の上限に当たり、`test_projects_flow.py` の3件が失敗した(カウンタが切れてから流し直した)。この Phase の integration は利用者を DB に直接作り、接続元の IP を差し替えた。[`retrospective-memo.md`](../retrospective-memo.md) の「統合テストとレート制限のカウンタを分ける」と同じ問題。
- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): 「Project {id} not found」がそのまま出る。直すなら、404 のときの文言を画面で「このプロジェクトは見つかりません(削除された可能性があります)」とし、ダッシュボードへのリンクを出す。
- **AlertDialog の開発時の警告**(Phase 64 から): Tamagui 2.6.0 の AlertDialog が、開く前に説明文を探して警告を出す(誤検知)。版を上げるときに消えるか確かめる。
- **トーストの v2 の API**(Phase 64 から): `@tamagui/toast/v2` の `Toaster` は 2.6.0 の web で `accessibilityLabel` を DOM に渡す。版を上げて直っていれば、v2 に寄せてもよい。
- **新規作成の後の一覧の cache**(Phase 65 から): `dashboard-store` の `invalidate` を呼ぶ所が無い。プロジェクトを作ってから20秒以内に同じ条件のダッシュボードへ戻ると、新しいプロジェクトが出ない。気になるなら、作成の成功で `invalidate()` を呼ぶ。
- **ダッシュボードの見出しの折り返し**(Phase 65 から): 幅 375px で「ダッシュボード」の見出しが3行に折り返す。Phase 72 の画面確認で見る。

この Phase で生まれたもの:

- **`ProjectListControls.tsx` の samples と本体の食い違い**(Phase 65 の完了後の調整から): 本体のコミット(`5269927`)の検索欄に `maxWidth="480px"` が無く、samples にはある。Phase 65 の introduction は「`maxWidth` 480px」と書いている。どちらが正しいかをユーザーが決め、もう一方を合わせる。
- **ほかの端末のアクセストークン**: パスワードを変えても、ほかの端末のアクセストークン(30分)はその寿命まで使える(refresh だけを失効させるため)。すぐに切りたいなら、トークンに発行の時刻を持たせ、パスワードの変更の時刻と比べる仕組みが要る(今は入れない)。
- **アカウントのフォームの縦の余白**: `FormGeneral` はボタンの下にスピナーの場所(40px)を持つので、3つのフォームの下に空きが出る。Phase 67 で節が増えたときの見た目と合わせて、操作感の確認で見る。
- **セッションの区切りの記録**: Phase 66 は1セッションで行った(Phase 65 の開始の指示 → 完了済みと確かめて Phase 66 に切り替え → 計画モードで調査 → 質問1回(4問)→ 計画の承認 → 66-1〜66-3 の実装 → ブラウザでの確認 → samples → docs → 教材)。

この Phase で解決したもの:

- **61-3 の Phase 66 の未確定事項**(変更の API の形・パスワードの規則・変更の後に今の端末のログインを保つか): 着手時の相談と [66-2](./Phase-66-2.md)。
- **マイページの項目**(Phase 62 から): CONTENTS の最後に足した([66-3](./Phase-66-3.md))。
- **パスワードの変更の後の印**(Phase 63 から): 今の端末のログインを保つので、印は消さない([66-3](./Phase-66-3.md))。
- **`users` テーブルの表のずれ**: [内部設計書](../../docs/internal_design.md) 3.2節の表を実際の列(`hashed_password`・`user_name`・`is_active`・`is_superuser`・`review_enabled`)に合わせた。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 列の改名を autogenerate に任せず、`alter_column(..., new_column_name=...)` で手書きしたのはなぜか。
2. 今のパスワードの不一致を 401 でなく 400 にしたのはなぜか。画面の `apiFetch` は 401 をどう扱うか。
3. パスワードを変えたとき、refresh を全部消してから今の端末に出し直す順序にしたのはなぜか。ほかの端末のアクセストークンはどうなるか。
4. パスワードの規則を登録の API に課さず、変更の API にだけ課したのはなぜか。今のパスワードに規則を課さないのはなぜか。
5. 今のパスワードの試行を、ログインと同じ上限で数えるのはなぜか。

## 次のフェーズ

**Phase 67**: モデルと API キーの登録(用途ごとのモデル・provider ごとの API キーのテーブル(Alembic)・Fernet と `ENCRYPTION_KEY`・カタログ・キーの確かめ(モデルの一覧)・seed(`.env` のモデルを既定値に)・API・マイページの画面(provider で絞るモデルの選択・判定の注記・キーの末尾だけ))。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(テーブルの形・既定値の行の持ち方と seed の上書きの規則・カタログの取得の API・キーの確かめの失敗の分け方・暗号の鍵の回し方)を決める。マイページは、この Phase の「アカウント」の H3 の節の後に、モデルと API キーの節を足す。マイページは新しい種類の画面なので、67 の直後にユーザーが操作感を確かめる。
