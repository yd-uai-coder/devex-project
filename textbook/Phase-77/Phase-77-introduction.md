# Phase 77 導入: マイページの画面(ステージ10)

## 目的

ステージ10の4つ目の実装 Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 77 として、[Phase 75](../Phase-75/Phase-75-introduction.md) の API(パスワードの設定・マイページからの連携と解除)をマイページ(SCR-009)から使えるようにする([外部設計書](../../docs/external_design.md) 2.13節「マイページ」)。Google のボタンと連携のダイアログは [Phase 76](../Phase-76/Phase-76-introduction.md) の部品を使う。

- パスワードの設定と、パスワードの有無での出し分け ── [77-1](./Phase-77-1.md)
- 「Google の連携」の枠(連携・解除)── [77-2](./Phase-77-2.md)

## パイプライン上の位置づけ・前提

```
マイページ(SCR-009)/ アカウントの節(AccountSection。GET /users/me の has_password・google_linked)
   ユーザーネーム(今までどおり)
   has_password ?
     ├ true : メールアドレスの変更・パスワードの変更(今までどおり)
     └ false: PasswordSetForm → POST /users/me/password → access を入れ直す        ──[77-1]
              → 読み直さずに has_password = true(上の2つと解除が出る)
   GoogleLinkSection                                                              ──[77-2]
     ├ 連携していない: GoogleSignInButton(continue_with。76-1)→ credential
     │    → GoogleLinkDialog(76-2 を文言の差し替えで共有)「このアカウントのパスワード」
     │    → POST /users/me/google {credential, current_password}
     │         ├ 200 UserRead → 連携している表示
     │         ├ 400 CURRENT_PASSWORD_MISMATCH → ダイアログの中に出す
     │         └ そのほか(409 CONFLICT・400・502・503)→ ダイアログを閉じて枠に出す
     │    (クライアント ID が無い環境: 「この環境では Google との連携を使えません。」)
     └ 連携している
          ├ パスワードあり: 「連携を解除する」→ ConfirmDialog → DELETE /users/me/google → access を入れ直す
          └ パスワードなし: 「パスワードを設定すると、連携を解除できます。」
```

- **前提として読むもの**: [73-3](../Phase-73/Phase-73-3.md)(Phase 77 のスコープと未確定事項)・[75-1](../Phase-75/Phase-75-1.md)・[75-2](../Phase-75/Phase-75-2.md)(3つの API とエラー)・[76-1](../Phase-76/Phase-76-1.md)・[76-2](../Phase-76/Phase-76-2.md)(ボタンとダイアログ)・外部設計書 2.12節(マイページ)と 2.13節。
- **今の仕組み**: マイページのアカウントの節は、ユーザーネーム・メールアドレス・パスワードの3つのフォームを並べる(Phase 66)。パスワードの変更は `PUT /users/me/password` の `AccessToken` をストアに入れ直す。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `a08351d`、devex-ui は `33aeef5`(Phase 76 はコミット済み。`e2e/stage9-flow.spec.ts` もコミット済み)、devex-api は `16258b4`。どれも変更なし。手元の OAuth クライアントは、`devex-api/.env` の `GOOGLE_CLIENT_ID` と `devex-ui/.env.local` の `NEXT_PUBLIC_GOOGLE_CLIENT_ID` に入っていた。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。Google のログインとマイページの連携の spec は Phase 79 で書き、既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 77 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 「Google の連携」の枠の置き場 | アカウントの節の中(推奨どおり) |
| 3 | 連携でいつ今のパスワードを聞くか | Google のボタンの後にダイアログ(推奨どおり) |
| 4 | 解除の確認 | 確認のダイアログで、ほかの端末が切れることを伝える(推奨どおり) |

Claude の判断(計画の承認で確定):

- ボタンの文言は `continue_with`(「Google で続行」)を足して使う。
- 連携のダイアログは 76 の `GoogleLinkDialog` を、文とボタンの文言の差し替えで共有する(#17)。欄のラベルは「このアカウントのパスワード」のまま。
- 不一致はダイアログの中、そのほかのエラーはダイアログを閉じて枠に、API の `detail` をそのまま出す。
- パスワードの設定の後は、読み直さずに表示を切り替える。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-77-1.md`](./Phase-77-1.md) | パスワードの設定と出し分け | あり(本体 4 + テスト 6) | 75 の API の形だけ |
| [`Phase-77-2.md`](./Phase-77-2.md) | 「Google の連携」の枠 | あり(本体 5 + テスト 5) | 77-1(`AccountRead` の2つの項目)・76-1(`GoogleSignInButton`)・76-2(`GoogleLinkDialog`) |

## サンプルコード一覧

`textbook/samples/frontend/` の新規・更新:

- 77-1: `src/features/mypage/api/accountApi.ts`・`src/features/mypage/schemas.ts`・`src/features/mypage/components/PasswordSetForm.tsx`(新規)・`src/features/mypage/components/AccountSection.tsx`・`__tests__/accountApi.test.ts`・`__tests__/schemas.test.ts`・`__tests__/PasswordSetForm.test.tsx`(新規)・`__tests__/AccountSection.test.tsx`・`__tests__/EmailForm.test.tsx`・マイページの `page.test.tsx`
- 77-2: `accountApi.ts`・`src/features/auth/components/GoogleSignInButton.tsx`・`src/features/auth/components/GoogleLinkDialog.tsx`・`src/features/mypage/components/GoogleLinkSection.tsx`(新規)・`AccountSection.tsx`・`__tests__/accountApi.test.ts`・`__tests__/GoogleSignInButton.test.tsx`・`__tests__/GoogleLinkDialog.test.tsx`・`__tests__/GoogleLinkSection.test.tsx`(新規)・`__tests__/AccountSection.test.tsx`
- ミラーしないもの: 無し(設定ファイル・環境変数の変更は無い)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [77-1](./Phase-77-1.md) | `accountApi.ts`・`schemas.ts`・`PasswordSetForm`・`AccountSection` | パスワードの有無で、変更とメールの変更か、設定かを出し分け、設定の後は読み直さずに切り替える | 送る形・スキーマの規則・設定の成功と失敗・出し分け・切り替え |
| [77-2](./Phase-77-2.md) | `accountApi.ts`・`GoogleSignInButton`・`GoogleLinkDialog`・`GoogleLinkSection` | credential と今のパスワードで連携し、パスワードがあれば確認の後に解除する | 送る形・文言の受け渡し・連携の成功・不一致・衝突・キャンセル・解除・出し分け・ID が無い環境 |

## 写経順序(#23)

章番号順(77-1 → 77-2)。各章の表の順(依存順。#30)に写す。マイグレーション・API・パッケージの変更は無い。

実 import 監査(#15。全 import 文を読んで確かめた):

- 77-1: `accountApi.ts` → `apiFetch`・`AccessTokenResponse`(既存)。`schemas.ts` → `newPasswordSchema` ほか(既存)。`PasswordSetForm.tsx` → `FormGeneral`・`InputPassword`・`useAuthStore`・`ApiError`(既存)・`setPassword`・`passwordSetSchema`・`PasswordSetValues`(この章。表で先に置く)。`AccountSection.tsx` → `PasswordSetForm`(この章)。テスト → 各 SUT・`stubFetch`・`useAuthStore`・`tamagui.config`(既存)。
- 77-2: `GoogleLinkSection.tsx` → `useAuthStore`・`ConfirmDialog`・`StyledButton`・`ApiError`(既存)・`GoogleLinkDialog`・`GoogleSignInButton`・`googleClientId`・`isFakeGoogle`(76)・`CURRENT_PASSWORD_MISMATCH`(66)・`linkGoogle`・`unlinkGoogle`(この章)・`AccountRead`(66。77-1 で項目を足した)。`AccountSection.tsx` → `GoogleLinkSection`(この章。表で先に置く)。テスト → 各 SUT と既存の道具。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: 77-1 までで `src/features/mypage` とマイページの画面の 37件(並列のとき、マイページの `page.test.tsx` が1件5秒を超えた。単独では成功)。77-2 までで `src/features/mypage`・`src/features/auth`・3つの画面の 68件。すべて成功。
- Phase 完了時の全体テスト(#18): `--maxWorkers=4` の1回目は 1063 件中 1 件失敗(`DfdEditorTabs` の「未保存の編集を知らせ…」。60ms で失敗し、タイムアウトではない。この Phase で触っていない。単独で2回流して成功)。2回目は **1063 件成功**(163 ファイル)。devex-api は変えていないので流していない。
- `npm run lint`: エラー 0(警告 1 は以前からの `streamChat.test.ts`)。`npx tsc --noEmit`: 0 件。`npm run build`: 成功。
- 偽のモードの手動確認: devex-api を `docker-compose.e2e.yml` と、CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ。リポジトリには置かない)を重ねて立て、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドした画面を 3100 番で開き、Playwright のその場のスクリプトで確かめた(手元の `npm run dev` が 3000 番で動いていたので止めずに別の番号にした)。9項目すべて成功。
  - Google だけの人: 設定が出て、メールの変更と解除は出ない / 設定するとメールの変更・パスワードの変更・解除が出る / リロードしてもログインが続く / 確認してから解除すると、連携していない表示になる / 解除の後もこの端末のログインが続く。
  - パスワードの人: ほかの人と連携済みの Google は、ダイアログを閉じて枠に出す / パスワードが違えばダイアログの中に出す / 正しいパスワードで、メールの違う Google と連携できる / その Google でログインすると、この人のアカウントに入る。
  - スクリーンショットで、衝突で閉じた後のダイアログにパスワードが残る作りに気づき、`key` で作り直すようにした([77-2](./Phase-77-2.md))。確かめた後、backend を通常の compose に戻し、3100 番を止め、通常のビルドを作り直した。
- **本物の Google での確認**: ユーザーが手元の OAuth クライアントで確かめ、**問題なし**(2026-10-18、Phase 77 の完了の後)。見た項目: ログインの画面(ポップアップが開いて閉じる・ボタンの文言・初めての Google でダッシュボード・既存のメールでダイアログ・`origin_mismatch` が出ない・リロードしてもログインが続く)とマイページ(「Google で続行」での連携・確認の後の解除・Google だけの人の設定のフォーム)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 798 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は、以前からの `change-impact-demo` のルート(Phase 72 と同じ)。`link_check.py`: リンク切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 76](../Phase-76/Phase-76-introduction.md#未消化の申し送り37) から引き継いだもの。

ステージ10の最後の Phase(**Phase 79**)へ。本番への反映と一緒に確かめる。中身は Phase 72 のとおり。

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節(ステージ9)の手順を、ステージ10の分と1つにまとめる。確認の表はステージごとに分ける。結果と Anthropic の費用は Phase 79 に記録し、[72-2](../Phase-72/Phase-72-2.md) からもリンクする。ステージ10の分は次のとおり(この Phase で増えたものは無い)。
  - マイグレーション `c4f8a2e6d1b9`。ロールバックの前に `SELECT count(*) FROM users WHERE hashed_password IS NULL` が 0 件か確かめる(docstring と [内部設計書](../../docs/internal_design.md) 3.2節)。
  - 本番の `.env` の `GOOGLE_CLIENT_ID`(無ければ Google のログインだけが 503)。`E2E_FAKE_GOOGLE` は書かない(書くと起動しない)。
  - **Vercel の `NEXT_PUBLIC_GOOGLE_CLIENT_ID`**: API と同じクライアント ID。ビルドで埋め込まれるので、入れた後に作り直す(再デプロイ)。`NEXT_PUBLIC_E2E_FAKE_GOOGLE` は書かない。本番の OAuth クライアントの JavaScript の生成元に Vercel の URL を入れる(73-3 の 79 の未確定事項)。
- **画面確認**(#37 の運用注記): Phase 62〜66・69 の画面確認(10.6節の表)を、Phase 79 で行う。Phase 76(ログイン・登録の画面の Google のボタンとダイアログ。ボタンの位置・幅・ダークモード・スマホの幅)と **Phase 77(マイページの「Google の連携」の枠・パスワードの設定のフォーム・2つのダイアログ。ダークモード・スマホの幅。Google のボタンの幅 300px が枠に収まるか)** の画面確認も足す。
- **origin の状態と手元の記録の食い違い**: devex-api の origin に `stage8` が無い。origin/main=`25974d9`、devex-ui の origin/main=`3c8369e`。反映のときに `git fetch` してから、出すコミットを確かめる。
- 画面確認で決めるもの:
  - **レビューを使えることの案内**(Phase 68 から)
  - **一覧の失敗の記録**(Phase 69 から)
  - **ダッシュボードの見出しの折り返し**(Phase 65 から)
  - **ログインの失敗の文が英語**(Phase 76 から): メールでのログインと連携の確かめでパスワードが違うとき、API の `Invalid email or password` がそのまま出る。日本語にするなら、API の文を変えるか、画面で 401 を読み替える。両方を一緒に変える(マイページの連携は 400 `CURRENT_PASSWORD_MISMATCH` を画面で日本語にしているので対象外)。
- 操作感の確認で見るもの:
  - **アカウントのフォームの縦の余白**(Phase 66 から)。この Phase で枠が1つ増え、Google だけの人は設定のフォームになった。節の長さも一緒に見る。
  - **閉じると保存していない編集が消える**(Phase 67 から)
- **Claude Haiku の推論のトークン**(Phase 68 から)・**値の欠けた答えを open に残す経路**(Phase 70 から): 本番での確認で見る。
- **Google のログインの E2E の spec**(Phase 76 から。この Phase でマイページの分を足した): 偽のボタン(「偽の Google アカウント(E2E)」の欄と「Google で続ける(E2E)」)で、初めての Google・連携の確かめ(ダイアログの欄は「このアカウントのパスワード」)・連携した後のメールのログインを確かめる。マイページの分は、この Phase の手動確認の9項目を spec にする(Google だけの人の設定と解除・パスワードの人の連携と衝突)。手元で `npm run dev` を先に立てていると、`reuseExistingServer` でそのサーバーが使われ、偽のボタンにならない。止めてから流す。ページに Next.js の `role="alert"` の空の要素(ルートの読み上げ)があるので、`getByRole("alert")` でなく文で取る。

ステージ10の後続の Phase へ:

- **Phase 78〜79 の未確定事項**: [73-3](../Phase-73/Phase-73-3.md)「未確定事項」(74〜77 の分は解決)。
- **偽のボタンの押せない見た目**(Phase 76 から → Phase 78): 偽のボタンはメールが空のとき `disabled` だが、`StyledButton` の見た目が変わらない。78 の `StyledButton` の `disabled` の見た目の直しで一緒に見る。この Phase の解除のボタン(送っている間 `disabled`)・連携のダイアログの「連携する」も同じ。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から。この Phase でもマイページの `page.test.tsx` が並列で5秒を超えた)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **`DfdEditorTabs` のテストのまれな失敗**(この Phase から): 全体テストの1回目で「開いている DFD の未保存の編集を知らせ、状態が変わったら段階の一覧を取り直す」が 60ms で失敗した(タイムアウトではない)。単独では2回とも成功し、2回目の全体テストも成功。次に同じ失敗が出たら原因を調べる。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **公開鍵の取得**(Phase 74 から): `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。ログインが増えて遅さが気になったら、`google.auth.transport.requests.Request` に `CacheControl` のセッションを渡してキャッシュする(今は入れない)。

この Phase で生まれたもの:

- **Phase 77 の未コミット**: 外側のリポジトリと devex-ui の変更。コミットはユーザーが行う(#35)。
- **セッションの区切りの記録**: Phase 77 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問1回(4問)→ 計画の承認 → 77-1・77-2 の実装 → 全体テスト・lint・型・ビルド → 偽のモードの手動確認(ダイアログを `key` で作り直すようにした)→ samples(`tagmerge.py` の後、ヘッダー・import のタグ・JSX のタグ・章の割り振りを手で直した)→ docs → 教材。

この Phase で解決したもの:

- **本物の Google での確認**(Phase 75 から。73-3 で 76 に置いたが、クライアントが無く持ち越した): この Phase の完了の後、ユーザーが確かめて問題なし(上の「検証結果」)。
- **73-3 の Phase 77 の未確定事項**(「Google の連携」の枠の置き場・解除の確認のダイアログ・パスワードの設定の後のメールのフォームの出し方): 着手時の相談と [77-1](./Phase-77-1.md)・[77-2](./Phase-77-2.md)。
- **マイページの画面**(Phase 75 から): パスワードの設定・連携・解除の出し分け、ボタンとパスワードの順、`continue_with`、解除の確認、409 の扱い([77-1](./Phase-77-1.md)・[77-2](./Phase-77-2.md))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. Google だけの人にメールの変更を出さないのはなぜか。パスワードを設定した後、読み直さずに表示を切り替えてよいのはなぜか。
2. マイページの連携で、パスワードの欄を Google のボタンより先に置かず、ボタンの後にダイアログで聞くのはなぜか。
3. 連携のエラーのうち、ダイアログの中に出すものと、ダイアログを閉じて枠に出すものを分けたのはなぜか。
4. 76 の `GoogleLinkDialog` を、コピーでなく props で共有したのはなぜか(#17 の判定の一問への答えは何か)。マイページでだけ `key` で作り直すのはなぜか。
5. 解除の確認のダイアログで、ほかの端末のログインが切れることを伝えるのはなぜか(API の側の何に合わせたか)。
