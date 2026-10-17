# Phase-73-3: ステージ10の実装計画(Phase 74〜79)

## この章の目的

[73-1](./Phase-73-1.md) の決定を Phase の単位に分ける。Phase ごとのスコープ・成果物・依存と、着手時に決める「未確定事項」を先に挙げておく([Phase 61-3](../Phase-61/Phase-61-3.md) と同じ形)。

自動実装モード: on([introduction](./Phase-73-introduction.md) 参照)。

## この章で作成・更新したファイル

なし(計画の文書)。一覧は [`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.1節のステージ10にも書いた。

## Phase の一覧

[`stage9-10-plan.md`](../../appendix/stage9-10-plan.md) 2.2節の案(API → UI → E2E と本番)を、API と UI のそれぞれで「認証」と「マイページ」に分けた。ステージ10の入力から入れた4件(73-1 の 12〜15)は 78 にまとめた。最後の 79 は、ステージ9の本番への反映も合わせて行う(CLAUDE.md #37 の運用注記)。

| Phase | スコープ | 主な成果物 | 依存 |
|---|---|---|---|
| 74 | Google 認証の API | Alembic(`hashed_password` を null 可・`google_sub` を一意で足す)・`google-auth` を明示の依存に・ID トークンの検証の部品(`GOOGLE_CLIENT_ID` を `aud` に。threadpool で呼ぶ。`E2E_FAKE_GOOGLE` の偽物。production では起動時に弾く)・`POST /auth/google`(`sub` → メールの順で探す・新規の登録・409 `GOOGLE_LINK_REQUIRED`・`email_verified` が false なら 400・設定が無ければ 503)・`POST /auth/google/link {credential, password}`・`google_ip` のカウンタ・Google だけのユーザーのパスワードでのログインは 401・`UserRead` の `has_password`・`google_linked`・開発用 compose(dev・test・e2e)の登録とログインの上限を上げる | なし |
| 75 | マイページの API | パスワードの設定(Google だけのユーザーは今のパスワードを求めない)・メールの変更はパスワードが無ければ断る・マイページからの連携(`credential` を送る。ほかの人と連携済みの `sub` は 409)・連携の解除(パスワードが無ければ断る) | 74 |
| 76 | ログインと登録の画面 | `@react-oauth/google`(`GoogleOAuthProvider` の置き場・`NEXT_PUBLIC_GOOGLE_CLIENT_ID` が無ければボタンを出さない)・ログインと登録の画面の Google ボタン・連携の確かめのダイアログ(パスワード)・成功で `auth-store` の `login()`(印の cookie)・戻り先(`safeRedirectPath`)。**着手前に、ユーザーが手元の確かめ用の OAuth クライアントを Google Cloud で作る**(手順は Phase の着手時に渡す) | 74 |
| 77 | マイページの画面 | パスワードの「変更」と「設定」の出し分け(`has_password`)・メールのフォームはパスワードがあるときだけ・「Google の連携」の枠(連携・解除。解除はパスワードがあるときだけ) | 75・76(Google のボタンの部品) |
| 78 | 小さな改善(ステージ10の入力) | 削除したプロジェクトの 404 の文言とダッシュボードへのリンク・新規作成の成功で `dashboard-store` の `invalidate()`・`StyledButton` の `disabled` の見た目・`ChatHistoryRepository.list_for_project` の並びの2つ目の鍵(原因の確かめを含む) | なし(順序の決定で 77 の後に置く) |
| 79 | 統合/E2E・本番への反映(ステージ9・10) | Google の流れの E2E(偽の検証)と既存を含めた全 E2E(#36)・マイグレーションの往復・`OPERATIONS.md` に、10.6節(ステージ9)とステージ10の分を1つにまとめた手順(Google Cloud の OAuth クライアント・承認済みの JavaScript 生成元・同意画面・`GOOGLE_CLIENT_ID` の2か所・パスワードが null の行を確かめるロールバック)・本番での確認の表をステージごとに分ける・ステージ9の画面確認と「画面確認で決める」項目・origin の食い違いの確かめ | 74〜78 |

- **E2E**(#36): Phase 79 で既存を含めた全 E2E を流す。74 の上限の引き上げで、全 E2E を同じ1時間に何度でも流せるようになる見込み。76 でログインの画面にボタンが増える。`e2e/helpers.ts` の `registerAndLogin` が使う欄の名前とボタンの文言が残るかは、76 で確かめる。
- **画面確認**(#37 の運用注記): 76・77 の画面確認は「未消化の申し送り」に積み、79 の本番での確認でまとめて行ってよい。ただし、本物の Google でのログインは 76 で、手元の OAuth クライアントを使って一度確かめる(偽の検証では分からない、ポップアップ・生成元の設定・Cookie の扱いを見るため)。
- **実 LLM の費用**: ステージ10の機能は LLM を呼ばない。79 の本番での確認は、Phase 72 で決めた範囲(一般の利用者の自分のキーで Haiku、superuser の既定の Sonnet 1回。見込み 約 $0.15・最大 約 $0.3)を引き継ぐ。
- **壊れそうなテスト**: devex-api の `test_auth_service.py`・`test_auth_rate_limit.py`・`test_auth_flow.py`・`test_user_*`(74・75。`hashed_password` が null になりうる)、devex-ui の `LoginForm`・`RegisterForm` のテスト(76)、`PasswordForm`・`EmailForm`・`AccountSection` のテスト(77)、`StyledButton` を使う画面のスナップショットや見た目の確かめ(78)。

## 未確定事項(着手時に決める)

| Phase | 未確定事項 |
|---|---|
| 74 | 連携の確かめでパスワードが違うときのコード(ログインと同じ 401 か、400 か)/ ほかの Google アカウントと連携済みのメールに、別の Google でログインしたときの応答 / 偽の credential の形(`fake:<sub>:<email>` など)/ `google_ip` の上限の値 / 上限を上げる値(dev・test・e2e で同じにするか) |
| 75 | パスワードの設定を `PUT /users/me/password` に寄せるか、別の API にするか / マイページから、メールが違う Google アカウントを連携できるか / 解除の後の refresh(ほかの端末を切るか) |
| 76 | `GoogleOAuthProvider` の置き場(認証の画面だけか、アプリ全体か)/ ボタンの見た目と位置(フォームの上か下か)/ 登録の画面でも同じボタンにするか(Google の場合はログインと登録が同じ処理のため)/ E2E のときの偽のボタン(`NEXT_PUBLIC_E2E_FAKE_GOOGLE`)の出し方 / 連携の確かめのダイアログの文言 |
| 77 | 「Google の連携」の枠の置き場(アカウントの節の中か、別の節か)/ 解除の確認のダイアログ / パスワードの設定の後のメールのフォームの出し方 |
| 78 | 404 の文言を出す画面の範囲(チャット・プレビュー・詳細設計)/ `StyledButton` の不透明度の値と、`disabled` で見た目が変わる他の画面の確かめ / 並びの2つ目の鍵(`id` か、作成の順の列か) |
| 79 | 本番の OAuth クライアントの生成元(Vercel の URL・カスタムドメイン)/ 同意画面の公開の状態(テストユーザーだけか、本番か)/ 本番での確認の範囲(Google のログイン・連携・解除)と、ステージ9の確認の表の残り |

## 範囲の外(申し送り)

- **生成の質の候補4件**(再生成のきっかけの残り・設計に無いテスト・日本語の名前のデータストア・語の表の範囲)。次に生成の質を扱うステージの仕様診断で決める。
- **持ち越し**: `test_chat_service.py` などの pyright の指摘・並列のテストのタイムアウト・偽 LLM の外部設計書の GET に DF が無い・モデルのカタログの見直し(`gemini-3.1-flash-lite` は 2027-05-07 以降に終了)。
- **Google 以外の外部の認証**(GitHub など)・**Google の API の利用**(Drive など。アクセストークンは受け取らない。73-1 の決定1)・**One Tap**(自動のサインイン。ボタンだけにする)。
- **確認メールの送信**(Phase 61 から範囲の外のまま)。
