# Phase 78 導入: 小さな改善(ステージ10)

## 目的

ステージ10の5つ目の実装 Phase。[73-3](../Phase-73/Phase-73-3.md) の Phase 78 として、ステージ10の入力から入れた小さな直し4件([73-1](../Phase-73/Phase-73-1.md) の 12〜15)を片付ける。どれもステージ9 以前から申し送ってきた項目で、Phase 79(E2E・本番への反映)の前に済ませる。

- 削除したプロジェクトの URL を開いたときの表示(Phase 64 から)── [78-1](./Phase-78-1.md)
- 新規作成の後のダッシュボードの cache(Phase 65 から)── [78-2](./Phase-78-2.md)
- 押せないボタンの見た目(Phase 69 から)── [78-3](./Phase-78-3.md)
- 負荷のときだけ落ちるテスト(Phase 72 から)── [78-4](./Phase-78-4.md)

## パイプライン上の位置づけ・前提

```
[78-1] チャット・文書・詳細設計の画面
         最初の読み込み(履歴・文書の一覧・段階の一覧)が 404
           → ストアの notFound = true(projectId が今の画面と同じときだけ見る)
           → 本体の代わりに ProjectNotFoundNotice(見出し・理由・ダッシュボードへのリンク)
[78-2] IntakeForm で作成に成功 → useDashboardStore.invalidate() → 次のダッシュボードで取り直す
[78-3] StyledButton(38 ファイルで使う)の disabled → opacity 0.5
[78-4] devex-api のテスト: 判定の時刻を、生成を始めた時刻から作る(本体は変えない)
```

- **前提として読むもの**: [73-3](../Phase-73/Phase-73-3.md)(Phase 78 のスコープと未確定事項)・[Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)(4件の中身)・[外部設計書](../../docs/external_design.md) 2.12節(プロジェクトの削除)。
- **今の仕組み**: 3つの画面はどれも、params の解決だけを Server Component で行い、Client Component(`*PageContent`)がストア(zustand)から読み込む。ストアは画面をまたいで残る。ダッシュボードの一覧は、鍵が同じで20秒以内なら取り直さない(`lib/api/cache.ts`)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `c6beaac`、devex-ui は `d719c38`、devex-api は `16258b4`(Phase 77 はコミット済み)。どれも変更なし。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。Phase 79 で既存を含めて全部流す。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 78 開始時」を参照。計画モードで1回(3問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 404 の表示を直す画面 | チャット・文書・詳細設計の3画面すべて(推奨どおり) |
| 3 | 落ちるテストの直し方(原因は並びでなく、テストの時刻の作り方だった) | テストだけ直す。並びの2つ目の鍵は足さない(推奨どおり) |

Claude の判断(計画の承認で確定):

- 404 は status だけで見る(`isNotFound`)。知らせは共通の部品にし、`role="alert"` は付けない。
- ストアには `status` の値を増やさず、`notFound` の真偽値を足す。画面は `projectId` が同じときだけ見る。
- `invalidate()` は作成の API の関数でなく `IntakeForm` で呼ぶ。
- `StyledButton` の不透明度は 0.5。素の `Button` にその場で付けている所はまとめない(#17 (b))。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-78-1.md`](./Phase-78-1.md) | 削除したプロジェクトの 404 の表示 | あり(本体 8 + テスト 8) | なし |
| [`Phase-78-2.md`](./Phase-78-2.md) | 新規作成の後のダッシュボードの cache | あり(本体 1 + テスト 1) | なし |
| [`Phase-78-3.md`](./Phase-78-3.md) | 押せないボタンの見た目 | あり(本体 1 + テスト 1) | なし |
| [`Phase-78-4.md`](./Phase-78-4.md) | 負荷のときだけ落ちるテスト | あり(テスト 1) | なし |

4章は互いに独立している。

## サンプルコード一覧

`textbook/samples/frontend/` の新規・更新:

- 78-1: `src/lib/api/client.ts`・`src/components/errors/ProjectNotFoundNotice.tsx`(新規)・`hearing-store.ts`・`documents-store.ts`・`detailed-design-store.ts`・`ChatPageContent.tsx`・`DocumentsPageContent.tsx`・`DetailedDesignPageContent.tsx` と、それぞれのテスト(`ProjectNotFoundNotice.test.tsx` は新規)
- 78-2: `src/features/hearing/components/IntakeForm.tsx`・`__tests__/IntakeForm.test.tsx`
- 78-3: `src/components/ui/primitives/StyledButton.tsx`(テンプレート由来。samples には新規)・`__tests__/StyledButton.test.tsx`(新規)

`textbook/samples/backend/` の更新:

- 78-4: `tests/unit/test_doc_generation_guard.py`

ミラーしないもの: 無し(設定ファイル・環境変数の変更は無い)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [78-1](./Phase-78-1.md) | `client.ts`・`ProjectNotFoundNotice`・3つのストア・3つの `*PageContent` | 最初の読み込みの 404 で、本体の代わりに見つからない知らせとダッシュボードへのリンクを出す | 404 の見分け・文とリンク・404 と 500 の違い・本体を出さない・別のプロジェクトの 404 を見ない |
| [78-2](./Phase-78-2.md) | `IntakeForm` | 作成の成功でダッシュボードの一覧の cache を切る | 成功で切れる・失敗では切れない |
| [78-3](./Phase-78-3.md) | `StyledButton` | 押せないときに薄くする | 押せないとき・押せるとき・呼ぶ側の上書き |
| [78-4](./Phase-78-4.md) | `test_doc_generation_guard.py` | 判定の時刻を、テストの中で始めた時刻から作る | しきい値の手前で戻さない・超えたら戻す |

## 写経順序(#23)

章番号順(78-1 → 78-2 → 78-3 → 78-4)。各章の表の順(依存順。#30)に写す。マイグレーション・API・パッケージの変更は無い。

実 import 監査(#15。全 import 文を読んで確かめた):

- 78-1: `hearing-store.ts`・`documents-store.ts`・`detailed-design-store.ts` → `isNotFound`(この章。`client.ts` を表で先に置く)。3つの `*PageContent.tsx` → `ProjectNotFoundNotice`(この章。表で先に置く)と各ストア(この章)。`ProjectNotFoundNotice.tsx` → `next/link`・`tamagui`(既存)。テスト → 各 SUT・`stubFetch`・`tamagui.config`(既存)。
- 78-2: `IntakeForm.tsx` → `useDashboardStore`(Phase 3。`invalidate` も Phase 3 からある)。
- 78-3: `StyledButton.tsx` → `tamagui`(既存)。
- 78-4: `test_doc_generation_guard.py` → `app.models.project.Project`(既存)。

前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが import する。

## 検証結果

- 章ごとの部分テスト: 78-1 までで `src/lib/api`・`src/components/errors`・`src/features/hearing`・`documents`・`detailed-design` の 630 件。1回目は 12 件、2回目は 1 件(`IntakeForm` の「テンプレートを選択すると…」)が5秒のタイムアウトで失敗した(5つのディレクトリをまとめて流した負荷。`IntakeForm.test.tsx` を単独で流して 6 件成功)。78-3 の `StyledButton.test.tsx` 3 件成功。78-4 の `test_doc_generation_guard.py` 7 件成功。
- 78-4 の原因の確かめ: 直す前のファイルで `LATER` を2分早めて流し、`assert recovered is True` で落ちることを確かめた(一時ファイル。確かめた後に消した)。
- Phase 完了時の全体テスト(#18): devex-ui は `--maxWorkers=4` の1回で **1076 件成功**(165 ファイル)。devex-api はユニット全体 **1494 件成功**。
- `npm run lint`: エラー 0(警告 1 は以前からの `streamChat.test.ts`)。`npx tsc --noEmit`: 0 件。`npm run build`: 成功。devex-api の `ruff check`(全体): 成功(ruff format はしない)。
- `samples_check.py`(`--api-since HEAD --ui-since HEAD`): 一致 802 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は、以前からの `change-impact-demo` のルート(Phase 72 と同じ)。`link_check.py`: リンク切れ 0 件。
- 画面での確認はしていない(#37 の運用注記。Phase 79 の画面確認へ積んだ)。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

[Phase 77](../Phase-77/Phase-77-introduction.md#未消化の申し送り37) から引き継いだもの。

ステージ10の最後の Phase(**Phase 79**)へ。本番への反映と一緒に確かめる。中身は Phase 72 のとおり。

- **本番への反映と本番での確認**: [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.6節(ステージ9)の手順を、ステージ10の分と1つにまとめる。確認の表はステージごとに分ける。結果と Anthropic の費用は Phase 79 に記録し、[72-2](../Phase-72/Phase-72-2.md) からもリンクする。ステージ10の分は次のとおり(この Phase で増えたものは無い)。
  - マイグレーション `c4f8a2e6d1b9`。ロールバックの前に `SELECT count(*) FROM users WHERE hashed_password IS NULL` が 0 件か確かめる(docstring と [内部設計書](../../docs/internal_design.md) 3.2節)。
  - 本番の `.env` の `GOOGLE_CLIENT_ID`(無ければ Google のログインだけが 503)。`E2E_FAKE_GOOGLE` は書かない(書くと起動しない)。
  - **Vercel の `NEXT_PUBLIC_GOOGLE_CLIENT_ID`**: API と同じクライアント ID。ビルドで埋め込まれるので、入れた後に作り直す(再デプロイ)。`NEXT_PUBLIC_E2E_FAKE_GOOGLE` は書かない。本番の OAuth クライアントの JavaScript の生成元に Vercel の URL を入れる(73-3 の 79 の未確定事項)。
- **画面確認**(#37 の運用注記): Phase 62〜66・69 の画面確認(10.6節の表)を、Phase 79 で行う。Phase 76(ログイン・登録の画面の Google のボタンとダイアログ。ボタンの位置・幅・ダークモード・スマホの幅)と Phase 77(マイページの「Google の連携」の枠・パスワードの設定のフォーム・2つのダイアログ。ダークモード・スマホの幅。Google のボタンの幅 300px が枠に収まるか)の画面確認も足す。**この Phase の分**: 削除したプロジェクトの URL を3画面で開いたときの知らせ(見出し・リンク・ダークモード・スマホの幅)/ 押せないボタンの薄さ(緑・gray・red の各テーマ、ダークモード。承認できない段階の「承認する」・偽の Google のボタン・連携のダイアログの「連携する」・送っている間の解除のボタン)/ プロジェクトを作ってすぐダッシュボードへ戻ると一覧に出ること。
- **origin の状態と手元の記録の食い違い**: devex-api の origin に `stage8` が無い。origin/main=`25974d9`、devex-ui の origin/main=`3c8369e`。反映のときに `git fetch` してから、出すコミットを確かめる。
- 画面確認で決めるもの:
  - **レビューを使えることの案内**(Phase 68 から)
  - **一覧の失敗の記録**(Phase 69 から)
  - **ダッシュボードの見出しの折り返し**(Phase 65 から)
  - **ログインの失敗の文が英語**(Phase 76 から): メールでのログインと連携の確かめでパスワードが違うとき、API の `Invalid email or password` がそのまま出る。日本語にするなら、API の文を変えるか、画面で 401 を読み替える。両方を一緒に変える(マイページの連携は 400 `CURRENT_PASSWORD_MISMATCH` を画面で日本語にしているので対象外)。
- 操作感の確認で見るもの:
  - **アカウントのフォームの縦の余白**(Phase 66 から)。Phase 77 で枠が1つ増え、Google だけの人は設定のフォームになった。節の長さも一緒に見る。
  - **閉じると保存していない編集が消える**(Phase 67 から)
- **Claude Haiku の推論のトークン**(Phase 68 から)・**値の欠けた答えを open に残す経路**(Phase 70 から): 本番での確認で見る。
- **Google のログインの E2E の spec**(Phase 76・77 から): 偽のボタン(「偽の Google アカウント(E2E)」の欄と「Google で続ける(E2E)」)で、初めての Google・連携の確かめ(ダイアログの欄は「このアカウントのパスワード」)・連携した後のメールのログインを確かめる。マイページの分は、Phase 77 の手動確認の9項目を spec にする(Google だけの人の設定と解除・パスワードの人の連携と衝突)。手元で `npm run dev` を先に立てていると、`reuseExistingServer` でそのサーバーが使われ、偽のボタンにならない。止めてから流す。ページに Next.js の `role="alert"` の空の要素(ルートの読み上げ)があるので、`getByRole("alert")` でなく文で取る(この Phase の見つからない知らせも見出しの文で取る)。
- **Phase 79 の未確定事項**: [73-3](../Phase-73/Phase-73-3.md)「未確定事項」(74〜78 の分は解決)。

ステージ10の範囲の外(次に生成の質を扱うステージの仕様診断で決める):

- **生成の質の候補4件**: 再生成のきっかけの残り(Phase 70)・設計に無いテスト(Phase 70)・日本語の名前のデータストア(Phase 71)・語の表の範囲(Phase 71)。中身は [Phase 72 の申し送り](../Phase-72/Phase-72-introduction.md#未消化の申し送り37)。

持ち越し(触るとき・期限の前に直す):

- **小さな持ち越し**: `test_chat_service.py` などの pyright の指摘(Phase 40 から)・並列のテストのタイムアウト(Phase 44 から。この Phase でも、5つのディレクトリをまとめた部分テストで `IntakeForm` などが5秒を超えた。全体テストの `--maxWorkers=4` では起きなかった)・偽 LLM の外部設計書の GET に DF が無い(Phase 45 から)。
- **`DfdEditorTabs` のテストのまれな失敗**(Phase 77 から): この Phase の全体テストでは出なかった。次に同じ失敗が出たら原因を調べる。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **公開鍵の取得**(Phase 74 から): `verify_oauth2_token` は呼ぶたびに Google の公開鍵を取りに行く。ログインが増えて遅さが気になったら、`google.auth.transport.requests.Request` に `CacheControl` のセッションを渡してキャッシュする(今は入れない)。

この Phase で生まれたもの:

- **Phase 78 の未コミット**: 外側のリポジトリ・devex-ui・devex-api の変更。コミットはユーザーが行う(#35)。
- **セッションの区切りの記録**: Phase 78 は1セッションで行った。計画モードで調査(エージェントは使わず直接。78-4 の原因はこの調査で見つけた)→ 質問1回(3問)→ 計画の承認 → 78-1〜78-4 の実装 → 原因の再現 → 全体テスト・lint・型・ビルド → samples(`tagmerge.py` の後、ヘッダー・import のタグ・置き場のずれを手で直した)→ docs → 教材。

この Phase で解決したもの:

- **削除したプロジェクトの URL を開いたときの表示**(Phase 64 から): [78-1](./Phase-78-1.md)。
- **新規作成の後の一覧の cache**(Phase 65 から): [78-2](./Phase-78-2.md)。
- **押せないボタンの見た目**(Phase 69 から)と、**偽のボタンの押せない見た目**(Phase 76 から): [78-3](./Phase-78-3.md)。
- **負荷のときだけ落ちるテスト**(Phase 72 から): [78-4](./Phase-78-4.md)。原因は並びでなかった。
- **73-3 の Phase 78 の未確定事項**(404 の画面の範囲・不透明度の値・並びの2つ目の鍵): 着手時の相談と各章。2つ目の鍵は撤回([Phase 73 の「後続 Phase での改訂」](../Phase-73/Phase-73-introduction.md#後続-phase-での改訂))。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. 削除したプロジェクトの知らせに「削除された可能性があります」と書き、言い切らないのはなぜか(API の 404 は何を区別しないか)。
2. 画面がストアの `notFound` を `projectId` と比べてから見るのはなぜか。比べないと、チャットの画面で何が起きるか。
3. 作成の成功で cache を切る処理を、API の関数でなくフォームに置いたのはなぜか。
4. `StyledButton` の `opacity` を `{...props}` の前に渡すのはなぜか。素の `Button` のその場の指定をまとめなかったのはなぜか。
5. 負荷のときだけ落ちたテストの原因は何だったか。Phase 72 の見立て(並び)が当たっていないと言えるのは、テストのどの事実からか。
