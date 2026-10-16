# Phase 63 導入: 認証ページの proxy(ステージ9)

## 目的

ステージ9の2つ目の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 63 として、ログイン済みで `/login`・`/register` を開いたら、画面を出さずにダッシュボード(戻り先があればその先)へ送る。devex-ui だけを変える(devex-api は変えない)。

- UI のオリジンにログインの印の cookie を置き、ログインの状態が変わるところで付け外しする ── [63-1](./Phase-63-1.md)
- `src/proxy.ts` で印を読んで振り分け、戻り先の確かめをログインのフォームと共有する ── [63-2](./Phase-63-2.md)

## パイプライン上の位置づけ・前提

```
ログイン(LoginForm)── login() ─────────┐
起動時の復元・サイレントリフレッシュ ── refreshTokens() 成功 ─┤─▶ 印を付ける[63-1]
                                       │
apiFetch の 401 ── refreshTokens() 失敗 / logout() ─┐
メニューのログアウト(useLogout)───────────────────┤─▶ 印を消す[63-1]
                                                    │
/login・/register の要求 ─[63-2 proxy: 印がある?]─ はい ─▶ 307 → ?redirect=(safeRedirectPath)か /dashboard
                                                  └ いいえ ─▶ フォームを出す
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 63 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節「認証ページを飛ばす」、[内部設計書](../../docs/internal_design.md)「認証ページの proxy」、[62-1](../Phase-62/Phase-62-1.md)(ログアウトは読み込み直し)。
- **今の仕組み**: アクセストークンはメモリ(Zustand、非 persist)、refresh cookie は API のオリジンの `path=/api/v1/auth`(httpOnly・14日)。UI のサーバー側からはどちらも見えない。Next.js 16.3.6 では `middleware.ts` が `proxy.ts` に改名された(同梱の文書 `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`)。
- **この Phase を始めた時点の状態**: devex-ui は Phase 62 の変更が未コミット(HEAD は `c4d701b`)。外側のリポジトリは、ステージ8の振り返り・ロードマップの修正・Phase 61・62 が未コミット。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部)。`e2e/helpers.ts` は未ログインで `/register` → `/login` を通るだけなので、proxy は効かない。認証ページの振り分けは、Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 63 開始時」を参照。3問すべて推奨どおり。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on |
| 2 | ログイン済みで `/login?redirect=…` を開いたときの送り先 | **戻り先を尊重する**(同じオリジンの相対パスなら。無い・不正なら `/dashboard`) |
| 3 | 印の寿命 | **refresh と同じ14日**(login・refresh で付け直す)。[61-3](../Phase-61/Phase-61-3.md) の「7日」は誤り |

Claude の判断(計画の承認で確定、または作業中):

- 印の名前は `devex_logged_in`、値は `1`(`Path=/`・`SameSite=Lax`・https なら `Secure`)。
- **付け外しを `auth-store` に集め、`client.ts` は変えない**: `apiFetch` の 401 は、`refreshTokens()` の失敗か `logout()` を必ず通るため([63-1](./Phase-63-1.md))。
- ログアウト(読み込み直し)では、読み込み直す前に印を消す。失効の API が失敗しても消し、refresh cookie が残っていれば復元で付き直す([63-1](./Phase-63-1.md))。
- `matcher` は `["/login", "/register"]` だけ。
- **ログインのフォームの戻り先の判定も `safeRedirectPath` に置き換えた**(#17)。前の判定は `//evil.example.com` を通していた(開いたリダイレクト)([63-2](./Phase-63-2.md))。
- 作業中: matcher のテストの関数は、同梱の文書の `unstable_doesProxyMatch` でなく旧名 `unstable_doesMiddlewareMatch` を使った(16.3.6 が公開しているのは旧名だけ)。

推奨と違った選択は0。範囲を広げたのは `LoginForm` の戻り先の判定(proxy と規則を共有するため。#39 の材料)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-63-1.md`](./Phase-63-1.md) | ログインの印の cookie | あり(本体 3 + テスト 3) | Phase 62(`useLogout`) |
| [`Phase-63-2.md`](./Phase-63-2.md) | 認証ページの proxy | あり(本体 3 + テスト 3) | 63-1(`LOGIN_FLAG_COOKIE`) |

## サンプルコード一覧

`textbook/samples/frontend/` の新規・更新:

- 63-1: `src/lib/auth-flag.ts`(新規)・`src/components/auth/auth-store.ts`・`src/components/auth/useLogout.ts`・`src/lib/__tests__/auth-flag.test.ts`(新規)・`src/components/auth/__tests__/auth-store.test.ts`・`src/components/auth/__tests__/useLogout.test.tsx`
- 63-2: `src/lib/redirect-path.ts`(新規)・`src/proxy.ts`(新規)・`src/features/auth/components/LoginForm.tsx`・`src/lib/__tests__/redirect-path.test.ts`(新規)・`src/__tests__/proxy.test.ts`(新規)・`src/features/auth/components/__tests__/LoginForm.test.tsx`
- ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [63-1](./Phase-63-1.md) | `auth-flag.ts`・`auth-store.ts`・`useLogout.ts` | 印の名前と付け外し / トークンの出し入れと同じ場所で付け外し / 読み込み直す前に消す | 付く・消える・1つだけ・ストアの4か所・401 → 再発行の失敗で消える・ログアウトの API の成否によらず消える |
| [63-2](./Phase-63-2.md) | `redirect-path.ts`・`proxy.ts`・`LoginForm.tsx` | 同じオリジンの相対パスだけ通す / 印があれば送る / 戻り先の判定を共有 | 通す・断る(`//`・`/\`・絶対 URL)・matcher の一致と不一致・印の有無・戻り先・空の印 |

## 写経順序(#23)

章番号順(63-1 → 63-2)。各章の表の順(依存順。#30)に写す。

実 import 監査(#15。全 import 文を読んで確かめた): 63-1 の `auth-flag.ts` は何も import しない。`auth-store.ts` → `apiFetch`・`AsyncStatus`(既存)・`setLoginFlag`・`clearLoginFlag`(63-1)、`useLogout.ts` → `apiFetch`(既存)・`clearLoginFlag`(63-1)。63-2 の `redirect-path.ts` は何も import しない。`proxy.ts` → `next/server`・`LOGIN_FLAG_COOKIE`(63-1)・`safeRedirectPath`(63-2)、`LoginForm.tsx` → 既存の import と `safeRedirectPath`(63-2)。テストの `proxy.test.ts` → `next/experimental/testing/server`(`getRedirectUrl`・`unstable_doesMiddlewareMatch`)・`config`・`proxy`(63-2)・`LOGIN_FLAG_COOKIE`(63-1)。前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: 各章のテストファイルと `src/lib`・`src/components/auth`・`src/features/auth`・login と register のページ(16ファイル・108件)、成功。
- Phase 完了時の全体テスト(#18): devex-ui **937 件成功**(140 ファイル。`--maxWorkers=4`)。devex-api は変えていないので流していない。
- `tsc --noEmit` 成功。`npm run lint`: エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- ブラウザでの確認(Playwright のスクリプト。dev の UI・API。利用者を1人登録した。登録の IP ごとの上限に当たったため、Phase 60 と同じく dev の Redis の `rate_limit:register_ip:3600:<IP>` を消した):
  - 未ログインの `/login` はフォーム。ログインすると印 `devex_logged_in=1`(`Path=/`・`SameSite=Lax`・残り14日)が付く。
  - ログイン中に `/login`・`/register` を開くと `/dashboard`。`/login?redirect=/projects/new?mode=detailed` は `/projects/new?mode=detailed`、`redirect=//evil.example.com` は `/dashboard`。
  - 読み込み直しても印は残る。メニューのログアウトで印が消え、`/login` はフォーム。
  - 古い印(refresh cookie を消し、印だけを残す)で `/login` → `/dashboard` のログイン必須ダイアログ、そこで印が消え、次の `/login` はフォーム。
- `samples_check.py`(`--ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 684 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

Phase 62 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 64〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase の全体テストでは出なかった)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 64〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62・63 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **確認メールの送信**: 範囲の外。
- **`users` テーブルの表のずれ**: [内部設計書](../../docs/internal_design.md) 3.2節(Phase 66 の改名で触る見込み)。
- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択(Phase 62)と、認証ページの振り分け(この Phase)は Phase 72 の本番確認でまとめて見る。本番は https なので、印に `Secure` が付くこともそこで確かめる。
- **マイページの項目**: Phase 66 で CONTENTS に足す。
- **ステージ8の振り返りとロードマップの修正・Phase 61〜63 の未コミット**: コミットはユーザーが行う。

この Phase で生まれたもの:

- **メールとパスワードの変更の後の印**(→ 66): パスワードの変更で refresh を全部失効させるとき、今の端末のログインを保たないなら、印も消す(ストアの `logout()` を通せば消える)。
- **登録の上限と手元の確認**: ブラウザの確認でも登録の上限(10回/時)に当たった。[`retrospective-memo.md`](../retrospective-memo.md) の「E2E を CI で流す」の追記と同じ問題。
- **セッションの区切りの記録**: Phase 63 は1セッションで行った(計画モードで調査 → 質問1回(3問)→ 計画の承認 → 63-1・63-2 の実装 → ブラウザでの確認 → samples → 教材)。

この Phase で解決したもの:

- **ログアウトの後の印の消し方**(Phase 62 で生まれたもの): 読み込み直す前に消す([63-1](./Phase-63-1.md#3-ログアウトで消すuselogoutts))。
- **61-3 の Phase 63 の未確定事項**(cookie の名前・寿命・401 で消す場所・`matcher`): 着手時の相談と [63-1](./Phase-63-1.md)・[63-2](./Phase-63-2.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. proxy から、メモリのアクセストークンも API のオリジンの refresh cookie も見えないのはなぜか。印を認証の判定に使わないのはなぜか。
2. 401 で印を消す処理を `client.ts` に書かず、ストアに集めたのはなぜか。どの経路が `refreshTokens()` の失敗と `logout()` を通るか。
3. ログアウトで、失効の API が失敗しても印を消してよいのはなぜか。
4. 印が古いとき、利用者はどこで受け止められ、どうして閉じ込められないか。
5. `startsWith("/")` だけの判定で、何が通ってしまっていたか。proxy と `LoginForm` で同じ関数を使うのはなぜか。

## 次のフェーズ

**Phase 64**: プロジェクトの削除(`DELETE /projects/{id}`・Redis の進み具合の鍵・バックグラウンドの処理の消失への強さ・`ConfirmDialog`・一覧のカードの組み直し・文書と詳細設計の画面の右端)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(消失への強さの作り方・削除した後に動いていた処理の記録・確認の文言)を決める。
