# Phase 76 導入: ログインと登録の画面(ステージ10)

## 目的

ステージ10の3つ目の実装 Phase で、最初の画面の Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 76 として、ログインと登録の画面に Google のボタンを置く([外部設計書](../../docs/external_design.md) 2.13節)。[Phase 74](../Phase-74/Phase-74-introduction.md) の API(`POST /auth/google`・`POST /auth/google/link`)を画面から使えるようにする。マイページの画面は Phase 77 で、この Phase のボタンの部品を使って作る。

- Google のボタンの部品(本物・偽・出さない)── [76-1](./Phase-76-1.md)
- ログイン・登録の画面での Google のログインと、連携の確かめのダイアログ ── [76-2](./Phase-76-2.md)

## パイプライン上の位置づけ・前提

```
ログイン・登録の画面(SCR-001)
   フォーム(メールとパスワード。今までどおり)
   ── または ──
   GoogleLoginSection                                                   ──[76-2]
     └ GoogleSignInButton                                               ──[76-1]
          ├ E2E: 偽のボタン → fake:<email>:<email>
          ├ クライアント ID が無い: 何も出さない(区切りごと出さない)
          └ GoogleOAuthProvider(ここでだけ GSI を読む)+ GoogleLogin → credential
     → POST /auth/google {credential}(74-3)
          ├ 200 → login() → ?redirect= か /dashboard
          ├ 409 GOOGLE_LINK_REQUIRED → GoogleLinkDialog(このアカウントのパスワード)──[76-2]
          │     → POST /auth/google/link {credential, password} → 200 → 同じく移る
          │                                                   └ 401 → ダイアログの中に出す
          └ そのほか(409 CONFLICT・400・502・503)→ API の detail を出す
マイページ(Phase 77)── GoogleSignInButton を使い、credential を /users/me/google に送る
```

- **前提として読むもの**: [73-1](../Phase-73/Phase-73-1.md)(決定1〜6)・[73-3](../Phase-73/Phase-73-3.md)(Phase 76 のスコープと未確定事項)・[74-2](../Phase-74/Phase-74-2.md)(偽の検証 `fake:<sub>:<email>`)・[74-3](../Phase-74/Phase-74-3.md)(2つの API とエラー)・外部設計書 2.12節(ログインの印の cookie・戻り先)と 2.13節。
- **今の仕組み**: ログインは `LoginForm`(`POST /auth/login` → `useAuthStore.login()` → `safeRedirectPath`)。登録は `RegisterForm`(`POST /auth/register` → `/login` へ)。エラーは `ApiError.message`(API の `detail`)をそのまま出す。
- **この Phase を始めた時点の状態**: devex-ui の HEAD は `c11673a` で、`e2e/stage9-flow.spec.ts` が未追跡(この Phase では触らない)。外側のリポジトリは `2f2e50d`、devex-api は `16258b4`(Phase 75 はコミット済み)。手元の OAuth クライアントはまだ無かった(`GOOGLE_CLIENT_ID`・`NEXT_PUBLIC_GOOGLE_CLIENT_ID` とも未設定)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。Google のログインの spec は Phase 79 で書き、既存を含めて全部流す。偽のボタンと `playwright.config.ts` の `env` はこの Phase で入れた。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 76 開始時」を参照。計画モードで2回(4問 + 1問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | `GoogleOAuthProvider` の置き場 | ボタンの部品の中(推奨どおり。1回目は「デメリットは?」と聞き返され、説明の後に選んだ) |
| 3 | ボタンの位置と登録の画面 | **フォームの下**(推奨はフォームの上)。登録の画面にも同じボタン |
| 4 | E2E の偽のボタンと spec | 偽のボタンはこの Phase、spec は Phase 79(推奨どおり) |

Claude の判断(計画の承認で確定):

- 偽のボタンは、メールの欄 + 「Google で続ける(E2E)」。`fake:<email>:<email>` を送る。ラベルと文言は、E2E の helpers が使う語と部分一致しないようにした。
- 連携のダイアログの文言は外部設計書 2.13節の文 + 「連携した後は、Google とメールアドレスのどちらでもログインできます。」。
- 登録の画面でも、Google で成功したらそのままログインしてダッシュボードへ(メールの登録のように `/login` へは送らない)。
- エラーは API の `detail` をそのまま出す。連携の 401 は、ログインと同じ英語の文(下の申し送り)。

推奨と違った選択は1件(3。フォームの上 → 下)。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-76-1.md`](./Phase-76-1.md) | Google のボタンの部品 | あり(本体 2 + 設定 2 + テスト 1) | なし(74 の API の形だけ) |
| [`Phase-76-2.md`](./Phase-76-2.md) | Google のログインと連携のダイアログ | あり(本体 4 + テスト 4) | 76-1(`GoogleSignInButton`・`GoogleButtonText`・`google-config`) |

## サンプルコード一覧

`textbook/samples/frontend/` の新規・更新:

- 76-1: `package.json`・`src/features/auth/google-config.ts`(新規)・`src/features/auth/components/GoogleSignInButton.tsx`(新規)・`playwright.config.ts`・`src/features/auth/components/__tests__/GoogleSignInButton.test.tsx`(新規)
- 76-2: `src/features/auth/components/GoogleLinkDialog.tsx`(新規)・`src/features/auth/components/GoogleLoginSection.tsx`(新規)・`src/app/login/page.tsx`・`src/app/register/page.tsx`・`__tests__/GoogleLinkDialog.test.tsx`(新規)・`__tests__/GoogleLoginSection.test.tsx`(新規)・2つの `page.test.tsx`
- ミラーしないもの(#21 の共通): `devex-ui/.env.example`(2つの変数)・`package-lock.json`・`devex-ui/CLAUDE.md`(バックエンド連携の節に、Google のボタンの部品と2つの環境変数を1項目足した)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [76-1](./Phase-76-1.md) | `google-config.ts`・`GoogleSignInButton`・`FakeGoogleButton` | 環境に合わせて、本物・偽・何も出さないを選び、credential だけを呼び出し側に返す | 設定の読み方・ID の有無・`text` の受け渡し・credential の有無・偽の credential の形 |
| [76-2](./Phase-76-2.md) | `GoogleLinkDialog`・`GoogleLoginSection`・2つの画面 | credential で Google のログインをし、要るときだけパスワードで連携してから、戻り先へ移る | 成功・連携・連携の 401・キャンセル・ほかのエラー・出さない環境・画面の並び |

## 写経順序(#23)

章番号順(76-1 → 76-2)。各章の表の順(依存順。#30)に写す。`npm install @react-oauth/google` を先に行う。マイグレーション・API の変更は無い。

実 import 監査(#15。全 import 文を読んで確かめた):

- 76-1: `GoogleSignInButton.tsx` → `@react-oauth/google`(この章の `package.json`)・`InputSimpleText`・`StyledButton`(既存)・`googleClientId`・`isFakeGoogle`(この章の `google-config.ts`。表で先に置く)。テスト → `GoogleSignInButton`・`GoogleButtonText`・2つの関数(この章)・`tamagui.config`(既存)。
- 76-2: `GoogleLinkDialog.tsx` → `InputPassword`・`StyledButton`(既存)。`GoogleLoginSection.tsx` → `apiFetch`・`ApiError`・`useAuthStore`・`AccessTokenResponse`・`safeRedirectPath`(既存)・`googleClientId`・`isFakeGoogle`・`GoogleSignInButton`・`GoogleButtonText`(76-1)・`GoogleLinkDialog`(この章。表で先に置く)。2つの `page.tsx` → `GoogleLoginSection`(この章)。テスト → 各 SUT・`useAuthStore`・`stubFetch`(既存)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: 76-1 は 5件、76-2 までで `src/features/auth` と2つの画面の 28件。すべて成功。
- Phase 完了時の全体テスト(#18): devex-ui は既定の並列で 1047 件中 2 件が5秒のタイムアウトで失敗(`IntakeForm` のテンプレートの選択・マイページの画面。どちらもこの Phase で触っていない。単独では成功。Phase 44 からの持ち越しの「並列のテストのタイムアウト」)。`--maxWorkers=4` で **1047 件成功**(161 ファイル)。devex-api は変えていないので流していない。
- `npm run lint`: エラー 0(警告 1 は以前からの `streamChat.test.ts`)。`npx tsc --noEmit`: 0 件。`npm run build`: 成功。
- 偽のモードの手動確認: devex-api を `docker-compose.e2e.yml` を重ねて立て、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドした画面を 3100 番で開き、Playwright のその場のスクリプトで確かめた(spec にはしていない)。初めての Google → `/dashboard` / パスワードで登録済みのメール → 登録の画面(`?redirect=/mypage`)で Google → ダイアログ → 違うパスワードはダイアログの中に `Invalid email or password` → 正しいパスワードで `/mypage` へ / 連携した後もメールとパスワードでログインできる(200)。ダイアログの欄のラベルが後ろのフォームと同じで、`getByLabel` が2つに当たったので「このアカウントのパスワード」に変えた。確かめた後、backend を通常の compose に戻し、通常のビルドを作り直した。
- **本物の Google での確認**: **未実施**(手元の OAuth クライアントがまだ無い)。下の申し送りを参照。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 794 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は、以前からの `change-impact-demo` のルート(Phase 72 と同じ)。`link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 75](../Phase-75/Phase-75-introduction.md#未消化の申し送り37) から引き継いだもの。

ステージ10の最後の Phase(**Phase 79**)へ。本番への反映と一緒に確かめる。中身は Phase 72 のとおり。

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節(ステージ9)の手順を、ステージ10の分と1つにまとめる。確認の表はステージごとに分ける。結果と Anthropic の費用は Phase 79 に記録し、[72-2](../Phase-72/Phase-72-2.md) からもリンクする。ステージ10の分は次のとおり(この Phase で UI の環境変数が増えた)。
  - マイグレーション `c4f8a2e6d1b9`。ロールバックの前に `SELECT count(*) FROM users WHERE hashed_password IS NULL` が 0 件か確かめる(docstring と [内部設計書](../../docs/internal_design.md) 3.2節)。
  - 本番の `.env` の `GOOGLE_CLIENT_ID`(無ければ Google のログインだけが 503)。`E2E_FAKE_GOOGLE` は書かない(書くと起動しない)。
  - **Vercel の `NEXT_PUBLIC_GOOGLE_CLIENT_ID`**(この Phase から): API と同じクライアント ID。ビルドで埋め込まれるので、入れた後に作り直す(再デプロイ)。`NEXT_PUBLIC_E2E_FAKE_GOOGLE` は書かない。本番の OAuth クライアントの JavaScript の生成元に Vercel の URL を入れる(73-3 の 79 の未確定事項)。
- **画面確認**(#37 の運用注記): Phase 62〜66・69 の画面確認(10.6節の表)を、Phase 79 で行う。Phase 76(ログイン・登録の画面の Google のボタンとダイアログ。ボタンの位置・幅・ダークモード・スマホの幅)と Phase 77 の画面確認も足す。
- **origin の状態と手元の記録の食い違い**: devex-api の origin に `stage8` が無い。origin/main=`25974d9`、devex-ui の origin/main=`3c8369e`。反映のときに `git fetch` してから、出すコミットを確かめる。
- 画面確認で決めるもの:
  - **レビューを使えることの案内**(Phase 68 から)
  - **一覧の失敗の記録**(Phase 69 から)
  - **ダッシュボードの見出しの折り返し**(Phase 65 から)
  - **ログインの失敗の文が英語**(この Phase から): メールでのログインと連携の確かめでパスワードが違うとき、API の `Invalid email or password` がそのまま出る(以前からのログインのフォームと同じ)。日本語にするなら、API の文を変えるか、画面で 401 を読み替える。両方を一緒に変える。
- 操作感の確認で見るもの:
  - **アカウントのフォームの縦の余白**(Phase 66 から)。Phase 77 でアカウントの節を変えるときにも見る。
  - **閉じると保存していない編集が消える**(Phase 67 から)
- **Claude Haiku の推論のトークン**(Phase 68 から)・**値の欠けた答えを open に残す経路**(Phase 70 から): 本番での確認で見る。
- **Google のログインの E2E の spec**(この Phase から): 偽のボタン(「偽の Google アカウント(E2E)」の欄と「Google で続ける(E2E)」)で、初めての Google・連携の確かめ(ダイアログの欄は「このアカウントのパスワード」)・連携した後のメールのログインを確かめる。手元で `npm run dev` を先に立てていると、`reuseExistingServer` でそのサーバーが使われ、偽のボタンにならない。止めてから流す。

ステージ10の後続の Phase へ:

- **Phase 77〜79 の未確定事項**: [73-3](../Phase-73/Phase-73-3.md)「未確定事項」(74〜76 の分は解決)。
- **手元の確かめ用の OAuth クライアントと、本物の Google での確認**(→ ユーザー。Phase 75 から。**この Phase で未実施**): 73-3 で「本物の Google でのログインは 76 で一度確かめる」と決めたが、クライアントがまだ無かった。次の手順で作り、確かめる(Phase 77 の着手前か、77 の中で。77 のマイページの連携も本物で見る)。
  1. Google Cloud Console の「API とサービス」→「OAuth 同意画面」: User type は「外部」、公開ステータスは「テスト」のまま、テストユーザーに自分の Google アカウントを足す。
  2. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ 種類は「ウェブ アプリケーション」。承認済みの JavaScript 生成元に `http://localhost:3000` と `http://localhost`。リダイレクト URI は要らない(ポップアップ方式)。client secret は使わない。
  3. クライアント ID を `devex-api/.env` の `GOOGLE_CLIENT_ID=` と `devex-ui/.env.local` の `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` に入れ、`docker compose up -d backend` と `npm run dev` をやり直す。
  4. 見るもの: ポップアップが開いて閉じる / ボタンの文言が日本語(ログイン・登録で違う)/ 初めての Google でダッシュボードへ / 既存のメールでダイアログ / 生成元のエラー(`origin_mismatch`)が出ない / リロードしてもログインが続く(refresh の Cookie)。
- **マイページの画面**(Phase 75 から → Phase 77): 出し分けは `has_password`・`google_linked` で。
  - パスワードが無い人: パスワードの「設定」(`POST /users/me/password`。応答は `AccessToken` で、変更と同じく今の端末のトークンを入れ替える)。メールの変更と解除は出さない。
  - パスワードがある人の連携: [`GoogleSignInButton`](../samples/frontend/src/features/auth/components/GoogleSignInButton.tsx)(76-1)の `onCredential` で credential を受け、今のパスワードと一緒に送る(`POST /users/me/google`。ボタンの後にパスワードを聞くか、先に聞くかは 77 で決める)。応答は `UserRead`。400 `CURRENT_PASSWORD_MISMATCH`・409 `GOOGLE_ACCOUNT_CONFLICT`・400 `GOOGLE_EMAIL_NOT_VERIFIED` の文言。ボタンの `text` は `signin_with` か `continue_with` を足すかも 77 で決める(今の型は2つだけ)。
  - 解除: `DELETE /users/me/google`。応答は `AccessToken`(今の端末のトークンを入れ替える)。ほかの端末が切れることを確認のダイアログで伝えるか、77 で決める。
  - 409 `PASSWORD_NOT_SET`・`PASSWORD_ALREADY_SET` は、出し分けが正しければ画面からは来ない(古い画面の状態のときだけ)。`detail` をそのまま出してよい。
- **偽のボタンの押せない見た目**(この Phase から → Phase 78): 偽のボタンはメールが空のとき `disabled` だが、`StyledButton` の見た目が変わらない。78 の `StyledButton` の `disabled` の見た目の直しで一緒に見る。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から。この Phase でも `IntakeForm`・マイページの画面のテストが既定の並列で5秒を超えた)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **公開鍵の取得**(Phase 74 から): `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。ログインが増えて遅さが気になったら、`google.auth.transport.requests.Request` に `CacheControl` のセッションを渡してキャッシュする(今は入れない)。

この Phase で生まれたもの:

- **Phase 76 の未コミット**: 外側のリポジトリと devex-ui の変更。コミットはユーザーが行う(#35)。
- **devex-ui の未追跡のファイル**: `e2e/stage9-flow.spec.ts`(ステージ9の E2E。Phase 75 から)。コミットするか、Phase 79 の E2E の前に確かめる(#35)。
- **セッションの区切りの記録**: Phase 76 は1セッションで行った。計画モードで調査(エージェントは使わず直接。`@react-oauth/google` は Context7 で確かめた)→ 質問2回(4問 + 1問)→ 計画の承認 → 76-1・76-2 の実装 → 全体テスト・lint・型・ビルド → 偽のモードの手動確認(ダイアログのラベルを直した)→ samples(`tagmerge.py` の後、ヘッダー・import のタグ・JSX のタグを手で直した)→ docs → 教材。

この Phase で解決したもの:

- **73-3 の Phase 76 の未確定事項**(Provider の置き場・ボタンの位置・登録の画面・偽のボタン・ダイアログの文言): 着手時の相談と [76-1](./Phase-76-1.md)・[76-2](./Phase-76-2.md)。
- **画面の文言**(Phase 74 から): 409 `GOOGLE_LINK_REQUIRED` はダイアログに、`GOOGLE_ACCOUNT_CONFLICT`・400 `GOOGLE_EMAIL_NOT_VERIFIED`・502 `GOOGLE_VERIFY_FAILED` は API の日本語の `detail` をそのまま出す([76-2](./Phase-76-2.md))。
- **`e2e/helpers.ts` の欄の名前とボタンの文言が残るか**(73-3 から): 残る。偽のボタンのラベルと文言を部分一致しないようにした([76-1](./Phase-76-1.md))。

## 後続 Phase での改訂

- [Phase 77-2](../Phase-77/Phase-77-2.md): `GoogleButtonText` に `"continue_with"`(マイページの連携の「Google で続行」)を足し、`GoogleLinkDialog` に省略可能な `description`・`submitLabel` を足した(既定値はこの Phase の文言で、ログイン・登録の画面は変わらない)。

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. `GoogleOAuthProvider` をアプリ全体でなくボタンの部品の中に置いたのはなぜか。その代わりに何を受け入れたか。
2. 設定の値を定数でなく関数(`googleClientId()`)で読むのはなぜか。`process.env.NEXT_PUBLIC_...` を書き下すのはなぜか。
3. 連携の確かめで、画面が credential を state に持ち、もう一度送るのはなぜか(API の側の何に合わせたか)。
4. 偽のボタンのラベルと、ダイアログのパスワードの欄のラベルを、既存の欄と違う語にしたのはなぜか。
5. 登録の画面の Google で、メールの登録のように `/login` へ送らず、そのままログインするのはなぜか。
