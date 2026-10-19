# Phase 79 導入: 統合/E2E・本番への反映(ステージ9・10)

## 目的

ステージ10(Google 認証)の最後の Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 79 として、Phase 74〜78 で作った Google でのログイン・登録・連携と小さな改善を通しで確かめ、ステージ9とまとめて本番に出す準備をする(CLAUDE.md #37 の運用注記。ステージ9の反映をここへ送った)。新しい機能は作らない([Phase 72](../Phase-72/Phase-72-introduction.md) と同じ型)。

- **ログインの失敗の文**: 英語のまま出ていた文を、本番の前に日本語にする([79-1](./Phase-79-1.md))。
- **E2E**: Google の流れの spec を1本足し、既存を含めた全 E2E を流す([79-2](./Phase-79-2.md))。
- **反映の手順**: ステージ9・10をまとめた手順(Google Cloud の OAuth クライアント・2か所のクライアント ID・6本のマイグレーション・2つの確認の表・ロールバック)を `OPERATIONS.md` 10.7節に書き、マイグレーションの往復を確かめる([79-3](./Phase-79-3.md))。
- **docs**: ステージ10の完了と、この Phase の決定を反映する([79-4](./Phase-79-4.md))。

## パイプライン上の位置づけ・前提

```
[79-1 devex-api]  InvalidCredentialsError の文 → errors.py の定数(日本語)
                  auth.py(パスワードのログイン)・google_auth.py(連携の確かめ・無効な人)が同じ文を投げる
   │ (画面は ApiError.message をそのまま出す)
[79-2 E2E(ブラウザ)]
  Playwright ─▶ devex-ui(NEXT_PUBLIC_E2E_FAKE_GOOGLE)─▶ devex-api(E2E_FAKE_LLM・E2E_FAKE_GOOGLE)
    google-auth-flow.spec.ts: 初めての Google / 連携の確かめ / Google だけの人の設定と解除 / 連携と衝突
    全 E2E(9件)を2回
[79-3 反映(手順書のみ)]
  OPERATIONS.md 10.7: バックアップ → head と本番のコミット → Google Cloud(同意画面・クライアント・生成元2つ)
                      → .env(鍵・クライアント ID)→ stage10 → main → 6本 → Vercel の ID → UI → 確認(2表)
  マイグレーションの往復: dev の DB の複製で 7c3e9ab5f4d6 ⇄ c4f8a2e6d1b9(null の行で止まることも)
   │
[79-4 docs]
```

- **前提として読むもの**:
  - [Phase 78 の introduction](../Phase-78/Phase-78-introduction.md)「未消化の申し送り」: この Phase が回収する申し送り(本番への反映・画面確認・決める項目・Google の E2E)。
  - [Phase 72](../Phase-72/Phase-72-introduction.md)・[72-2](../Phase-72/Phase-72-2.md)(10.6節。ステージ9の鍵・既定のモデル・5本のマイグレーション)。
  - [Phase 74](../Phase-74/Phase-74-introduction.md)(偽の検証 `fake:<sub>:<email>`・マイグレーション `c4f8a2e6d1b9`)・[Phase 76](../Phase-76/Phase-76-introduction.md)(偽のボタン)・[Phase 77](../Phase-77/Phase-77-introduction.md)(マイページの手動確認の9項目)。
- **この Phase を始めた時点の状態**:
  - E2E は Phase 72 から流していなかった(#36)。
  - 本番は 10.5 の版(alembic の head `7c3e9ab5f4d6`。記録による)。devex-api のステージ8〜10のコミットは手元の `stage7` ブランチに積んであり(origin/stage7 より 20 先)、devex-ui の `main` は origin より 16 先。
  - 外側のリポジトリは `c6beaac`、devex-ui は `d719c38`、devex-api は `16258b4`(Phase 77 までコミット済み)。**Phase 78 の変更は未コミット**のまま、この Phase の変更が重なった(コミットの案は2つに分ける。下の「未消化の申し送り」)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(AI が本体へ実装し、`textbook/samples/` も同じ内容で作った)。

E2E: **この Phase で既存を含めた全 E2E を流す**(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 79 開始時」を参照。計画モードで1回(4問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モードと E2E の範囲 | on。Google の spec を**1本**足し、既存を含めて全部流す(推奨どおり) |
| 2 | ログインと連携の確かめの英語の文 | **今、API の文を日本語にする**(推奨どおり。申し送りでは「画面確認で決める」だったものを前倒し) |
| 3 | 本番の OAuth の同意画面 | **本番環境で公開**(推奨どおり) |
| 4 | 本番の OAuth クライアントの JavaScript の生成元 | **Vercel の URL とカスタムドメインの両方**(推奨は Vercel の URL だけ) |

Claude の判断(計画の承認で確定、または作業中):

- 2つの文は `app/services/errors.py` の定数にして、`auth.py` と `google_auth.py` が同じ文を投げる([79-1](./Phase-79-1.md))。
- 本番用の OAuth クライアントは、手元のものと分けて新しく作る([79-3](./Phase-79-3.md))。
- **作業中**: ステージ10だけを戻すときは、マイグレーションを戻さずコードだけを戻すのを先に置いた(downgrade は Google だけの利用者がいると止まり、通っても連携を全部消す。[79-3](./Phase-79-3.md))。
- **作業中**: `git fetch` で、devex-api・devex-ui とも origin にステージ8のコミットが無いことが分かった。10.7節の 2 で本番の head を見て分岐する形にした。
- **作業中**: ユーザーの `npm run dev` が 3000 番で動いていたので、Phase 77 と同じく止めずに 3100 番で E2E を流した([79-2](./Phase-79-2.md))。
- インフラの文書(`OPERATIONS.md`)は samples に写さない(#21)。

推奨と違った選択は1件(4問目の生成元)。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-79-1.md`](./Phase-79-1.md) | ログインの失敗の文を日本語に | あり(本体 3 + テスト 3) | なし |
| [`Phase-79-2.md`](./Phase-79-2.md) | Google の流れの E2E と全 E2E の実行 | あり(E2E 2) | 79-1(spec が日本語の文を確かめる) |
| [`Phase-79-3.md`](./Phase-79-3.md) | マイグレーションの往復と反映の手順(`OPERATIONS.md` 10.7) | `OPERATIONS.md`(インフラの文書のため #13/#15/#30 の対象外) | 79-1・79-2(テストが通ってから出す) |
| [`Phase-79-4.md`](./Phase-79-4.md) | `docs/*.md` への反映 | `docs/` 配下(文書のため #13/#15/#30 の対象外) | 79-1〜79-3 |

## サンプルコード一覧

- `textbook/samples/backend/`:
  - 更新(79-1): `app/services/errors.py`・`app/services/auth.py`・`app/services/google_auth.py`・`tests/unit/test_user_google_columns.py`・`tests/unit/test_google_auth.py`
  - samples に新規(79-1。テンプレート由来): `tests/unit/test_auth_service.py`
- `textbook/samples/frontend/`:
  - 更新(79-2): `e2e/helpers.ts`
  - 新規(79-2): `e2e/google-auth-flow.spec.ts`

ミラーしないもの: `devex-api/OPERATIONS.md`(79-3)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [79-1](./Phase-79-1.md) | `errors.py`・`auth.py`・`google_auth.py` | パスワードが違う・無効な利用者の 401 を、ログインと連携の確かめで同じ日本語の文にする | 違うパスワード・Google だけの人・連携の確かめが同じ文 / 無効な人は別の文 |
| [79-2](./Phase-79-2.md) | `google-auth-flow.spec.ts`・`helpers.ts` | 偽のボタンで、ログインの画面とマイページの Google の流れを通す | 初めての Google / 連携の確かめと日本語の文 / 設定と解除 / 連携と衝突 / 全 E2E が通る |
| [79-3](./Phase-79-3.md) | `OPERATIONS.md` 10.7 | ステージ9・10をまとめて出す手順とロールバック | (自動のテストなし)往復2回・null の行での失敗 |
| [79-4](./Phase-79-4.md) | `docs/*.md` | 完了と決定の反映 | (自動のテストなし)リンク切れ 0 |

## 写経順序(#23)

章番号順(79-1 → 79-2 → 79-3 → 79-4)。79-2 の spec は 79-1 の文を確かめるので、79-1 の後に流す。各章の表の順(依存順。#30)に写す。マイグレーション・パッケージの変更は無い。

実 import 監査(#15。全 import 文を読んで確かめた):

- 79-1: `auth.py`・`google_auth.py` → `app.services.errors.INVALID_CREDENTIALS_MESSAGE`・`INACTIVE_USER_MESSAGE`(この章。`errors.py` を表で先に置く)。テスト3本 → 同じ定数(この章)・各 SUT(Phase 74・75 以前)・`tests.fixtures.fake_redis`・`fake_google`(Phase 74)。
- 79-2: `google-auth-flow.spec.ts` → `@playwright/test`(既存)・`./helpers` の `PASSWORD`・`uniqueEmail`(この章で export。`helpers.ts` を表で先に置く)・`registerAndLogin`(Phase 24)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 79-1 の部分テスト: `test_auth_service.py`・`test_user_google_columns.py`・`test_google_auth.py`・`test_google_link_mypage.py` の **45件成功**。
- 79-2: 新しい spec は1回目 4件中1件失敗(spec の側の見出しの取り方)、直して4件成功。**全 E2E 9件成功を2回**(既存5 + 新4。1回 2.3分)。
- Phase 完了時の全体テスト(#18): devex-api はユニット全体 **1495件成功**(Phase 78 の 1494 + この Phase の1件)。devex-ui は本体のコードを変えていない(E2E の spec と helpers だけ)ので Jest の全体は流していない。
- `ruff check`(devex-api 全体): 成功(ruff format はしない)。devex-ui の `npx tsc --noEmit`: 0件。`npm run lint`: エラー 0(警告 1 は以前からの `streamChat.test.ts`)。`npm run build`: 成功(偽のボタンのビルドの後、通常のビルドに作り直した)。
- マイグレーションの往復: dev の DB の複製で2往復成功。null の行があるときの downgrade の失敗も確かめた([79-3](./Phase-79-3.md))。
- `samples_check.py`・`link_check.py`: 下の「samples と リンクの確かめ」(どちらも 0 件)。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 78](../Phase-78/Phase-78-introduction.md#未消化の申し送り37) から引き継いだもの。

**本番への反映と本番での確認は 2026-10-18 に済んだ**(下の「本番での確認の記録」)。ユーザーが行うものとして積んでいた次の項目は、すべて解決した:

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.7節の手順で行う。結果と Anthropic の費用(見込み 約 $0.15・最大 約 $0.3)は、反映の後に、この節と [72-2](../Phase-72/Phase-72-2.md) から辿れるように記録する。#39 の「本番での確認の指摘」(ステージ9・10の両方)も、そのときに [`overall-retrospective.md`](../retrospectives/overall-retrospective.md) の 14.5・15.5 と 11.1 の表に埋める。
- **origin の状態と手元の記録の食い違い**(Phase 72 から。この Phase で中身が分かった): devex-api・devex-ui とも origin の `main` はステージ7の版で、ステージ8のコミットも origin に無い。10.7節の 2 で本番の head(`7c3e9ab5f4d6` か `e5f6a7b8c9d1` か)と、VPS が動かしているコミットを確かめてから進む。
- **画面確認**(#37 の運用注記): 10.7節の 8 の2つの表(ステージ9: Phase 62〜66・69・78 の画面と操作感 / ステージ10: Phase 76・77 のボタン・ダイアログ・枠、ダーク・375px)。
- 画面確認で決めるもの(本番を見て、**3件とも今のままでよい**とユーザーが決めた):
  - **レビューを使えることの案内**(Phase 68 から)
  - **一覧の失敗の記録**(Phase 69 から)
  - **ダッシュボードの見出しの折り返し**(Phase 65 から)
- 操作感の確認で見るもの: **アカウントのフォームの縦の余白**(Phase 66 から)・**閉じると保存していない編集が消える**(Phase 67 から)。
- **Claude Haiku の推論のトークン**(Phase 68 から)・**値の欠けた答えを open に残す経路**(Phase 70 から): 本番での確認で見る。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **`DfdEditorTabs` のテストのまれな失敗**(Phase 77 から): この Phase では Jest の全体を流していないので、出ていない。次に同じ失敗が出たら原因を調べる。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **公開鍵の取得**(Phase 74 から): `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。遅さが気になったら `CacheControl` のセッションでキャッシュする(今は入れない)。
- **`ListCard` の入れ物**(本番確認後の調整から): `LayoutGrid` と同じく `YStack` に CSS Module の `display: grid` を付けているので、本番では縦1列になる。アプリのどの画面も使っていないので直していない。使うときに `LayoutGrid` と同じく素の `div` にする(下の「本番確認後の調整」)。
- **英語のままの refresh の文**(この Phase から): `Invalid or expired refresh token` など。画面には出ないので変えていない([79-1](./Phase-79-1.md))。
- **`tagmerge.py` の手直し**(ステージ10の振り返りから): on の Phase 75〜79 で毎回、ヘッダー・import のタグ・JSX のタグ・移した行を手で直した。次のステージの仕様診断(#28)で、改善を範囲に入れるかを決める([`overall-retrospective.md`](../retrospectives/overall-retrospective.md) 15.1 の Q6)。

この Phase で生まれたもの:

- **Phase 78・79 の未コミット**: 外側のリポジトリ・devex-ui・devex-api。コミットはユーザーが行う(#35)。Phase 78 と 79 を分けてコミットする(devex-api の Phase 78 の分は `tests/unit/test_doc_generation_guard.py` だけ。devex-ui の Phase 78 の分は `src/` の変更、79 の分は `e2e/` の2ファイル)。git タグは `phase-78`・`phase-79`。
- **セッションの区切りの記録**: Phase 79 は1セッションで行った。計画モードで調査(エージェントは使わず直接)→ 質問1回(4問)→ 計画の承認 → 79-1 の実装と部分テスト → samples(`tagmerge.py` の後、ヘッダーと import のタグを手で直した)→ 79-2 の spec(3100 番の偽のビルド)→ 全 E2E を2回 → 環境を戻す → 往復(dev の DB の複製)→ `git fetch` で origin の確かめ → `OPERATIONS.md` 10.7 → ユニット全体・ruff → docs → 教材。

この Phase で解決したもの:

- **ステージ10の振り返り**(#10・#25・#39): 別セッションで、本番への反映の前に行った([`overall-retrospective.md`](../retrospectives/overall-retrospective.md) 15節)。
- **ログインの失敗の文が英語**(Phase 76 から): [79-1](./Phase-79-1.md)。「画面確認で決める」から前倒しした。
- **Google のログインの E2E の spec**(Phase 76・77 から): [79-2](./Phase-79-2.md)。
- **全 E2E**(#36): [79-2](./Phase-79-2.md)。
- **本番への反映の手順**(ステージ9・10をまとめる): [79-3](./Phase-79-3.md) の 10.7節。反映そのものはユーザーが行う(上)。
- **73-3 の Phase 79 の未確定事項**(生成元・同意画面・本番での確認の範囲): 着手時の相談と [79-3](./Phase-79-3.md)。

## samples と リンクの確かめ

- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 804 / 並び順のみ差 8 / 例外 5 / 本体のみ 0。「samples のみ」2件は、以前からの `change-impact-demo` のルート(Phase 72・78 と同じ)。Phase 78 の 802 から、`e2e/google-auth-flow.spec.ts` と `tests/unit/test_auth_service.py` の2件が増えた。
- `link_check.py`: リンク 6984 件 / 切れ 0 件。

## 本番での確認の記録

2026-10-18、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.7節の手順で、ステージ9・10をまとめて本番へ反映した(ユーザー)。

- **反映**: devex-api は PR #9(`stage8-10` → `main`、`bbbff94`)。origin にステージ8以降が無かった件は、この PR で解消した。1回目の自動デプロイは、VPS の `.env` の1行目に余計な `]` が入っていて、`docker compose` が `.env` を読めず build の段で止まった(マイグレーションは走らず、古いコンテナのまま)。1文字を消して流し直し、成功した。
- **暗号の鍵**: 最初に作った本番の `ENCRYPTION_KEY` の値がチャットに出たので、使わずに作り直した(暗号化した行はまだ無かったので、失うものは無い)。
- **本番での確認**(10.7節の 8): ステージ9・10の2つの表と Claude の確認(一般の利用者の自分のキーの Haiku・superuser の Sonnet のレビュー)は**問題なし**。Anthropic の費用は見込み(約 $0.15・最大 約 $0.3)の範囲内。画面確認で決める3件(レビューの案内・一覧の失敗の記録・見出しの折り返し)は、すべて今のままでよい。
- **指摘**: 1件(トップページのカードが本番だけ縦1列)。下の「本番確認後の調整」で直し、再デプロイの後に問題なし。

## 本番確認後の調整

ステージ9・10の本番への反映の後、ユーザーの確認で見つかったもの(#38)。

### トップページの「はじめる」のカードが本番で縦に並ぶ

- **事象**: トップページの3枚のカード(CONTENTS・Authentication・Guide)が、開発では横3列、本番(Vercel)では縦1列になった。開発に合わせる(ユーザーの指示)。
- **原因**: `LayoutGrid` はグリッドの入れ物を Tamagui の `YStack` にし、CSS Module の `.grid` で `display: grid` を付けていた。本番ビルドの HTML では、Tamagui の `.is_View { display: flex; flex-direction: column; … }` が `<style>` で CSS Module の `<link>` より後ろに入り、同じ詳細度なので `display: flex` が勝つ。開発サーバーでは CSS Module が後から差し込まれるので再現しない。トップページは [Phase 62](../Phase-62/Phase-62-introduction.md) から `LayoutGrid` を使っており、本番では今回初めて出た。
- **直し**: 入れ物を素の `<div>` にした(Tamagui のクラスが付かず、順に左右されない)。効いていなかった `gap="$1"` は落とした。同じ部品の `Gallery` も直る。

| ファイル | 内容 |
| --- | --- |
| [`src/components/ui/layout-blocks/LayoutGrid.tsx`](../samples/frontend/src/components/ui/layout-blocks/LayoutGrid.tsx) | 入れ物を `YStack` から `div` に(テンプレート由来で、samples に初めて載せた) |
| [`src/components/ui/layout-blocks/__tests__/LayoutGrid.test.tsx`](../samples/frontend/src/components/ui/layout-blocks/__tests__/LayoutGrid.test.tsx) | 新規。入れ物が `div` で `is_View` を持たない / 列数の CSS 変数(既定 2・4、`columns` の指定)/ 子ごとのセル |

テスト観点(`LayoutGrid.test.tsx`。SUT は `LayoutGrid`、ドライバは描画、スタブ不要 ── 対象が純粋な描画で外部依存を呼ばないため): 1つ目のテストは、直す前の `YStack` の版で落ちることを確かめた。

- **検証**: 部分テスト(`layout-blocks`・`media`・トップページ)9件成功、`npx tsc --noEmit` 0件、`npm run lint` エラー0、`npm run build` 成功。ビルドした HTML でグリッドの要素のクラスが CSS Module のものだけであること、`next start`(3100 番)を Playwright で開いて、幅 1280px で3列(`display: grid`、3つの上端が同じ)、375px で1列になることを確かめた。`samples_check.py`: 一致 806 / 本体のみ 0、`link_check.py`: 切れ 0。
- 同じ型の `ListCard` は使われていないので残した(上の申し送り)。テンプレートの落とし穴として [`devex-ui/CLAUDE.md`](../../devex-ui/CLAUDE.md) と [`retrospective-memo.md`](../retrospective-memo.md) に書いた。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. ログインの失敗の文を、画面で読み替えずに API の文で直したのはなぜか。2つのサービスで同じ定数を使うのはなぜか。
2. E2E で本物の Google を呼ばずに偽の検証を使うと、何が確かめられて、何が確かめられないか。確かめられないものは、どこで見るか。
3. ステージ10の UI を API より後に出すのはなぜか。`NEXT_PUBLIC_GOOGLE_CLIENT_ID` を足した後に再デプロイが要るのはなぜか。
4. downgrade が Google だけの利用者で止まるのはなぜか。止まらなかったとしても、ステージ10だけを戻すときにコードだけを戻すのを先に考えるのはなぜか。
5. 生成元に Vercel の URL とカスタムドメインの両方を入れるとき、ほかに同じ2つを入れておく設定はどこか。
