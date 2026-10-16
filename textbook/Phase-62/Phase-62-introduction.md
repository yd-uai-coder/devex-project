# Phase 62 導入: 画面の小さな調整(ステージ9)

## 目的

ステージ9(使い勝手とアカウント・モデル設定の調整)の最初の実装 Phase。[61-3](../Phase-61/Phase-61-3.md) の Phase 62 として、日常の使い勝手の小さな穴を devex-ui だけで直す(devex-api は変えない)。

- ヘッダーのタイトルをトップページへのリンクにし、ログアウトの処理を作る ── [62-1](./Phase-62-1.md)
- メニューを TOP / CONTENTS / Authentication / Guide に組み直し、ログインの状態で出し分ける ── [62-2](./Phase-62-2.md)
- メニューからの新規作成(mode なしの `/projects/new`)でモードを選ばせる ── [62-3](./Phase-62-3.md)
- チャットを専用の領域に入れ、最下部から出す ── [62-4](./Phase-62-4.md)

## パイプライン上の位置づけ・前提

```
ヘッダー ─[62-1 タイトル → /]
メニュー(サイド・トップ・404)─[62-2 MENU_TREE + visibleMenuTree + MenuEntry]
   ├ CONTENTS ─ 新規プロジェクト作成 ─▶ /projects/new ─[62-3 mode なし → ModeSelectDialog]─▶ ?mode=…
   └ Authentication ─ ログアウト ─[62-1 useLogout: POST /auth/logout → / を読み込み直す]
チャット(SCR-004)─[62-4 会話の領域 + 読み込み後に最下部 + 追従]
```

- **前提として読むもの**: [61-3](../Phase-61/Phase-61-3.md)(Phase 62 のスコープと未確定事項)、[外部設計書](../../docs/external_design.md) 2.12節(ヘッダーとメニュー・モード選択・チャットの表示)、[`stage9-10-plan.md`](../../appendix/stage9-10-plan.md) 1.2節(影響調査)。
- **今の仕組み**: ログインの状態はストア(`useAuthStore`。アクセストークンはメモリだけ)にあり、初期値は `loading`、起動時の復元(`AuthBootstrap`)で `success` か `idle` になる。`RequireAuth` は `loading` の間は何も出さず、トークンが無ければログイン必須ダイアログを出す。`MENU_TREE` はサイドメニュー・トップページ・404 の3か所が読む。
- **この Phase を始めた時点の状態**: devex-ui・devex-api は Phase 60 までコミット済み(devex-ui の HEAD は `c4d701b`)。外側のリポジトリは、ステージ8の振り返り・ロードマップの修正・Phase 61 が未コミット。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない(Phase 72 で既存を含めて全部)。E2E の `helpers.ts` が使う文言(「新規プロジェクトを作成」・「…で作成する」)は変えていない。メニューとチャットの画面の流れは、Playwright のスクリプトでブラウザを動かして確かめた(下の「検証結果」)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 62 開始時」を参照。4問のうち3問は推奨どおり、1問は推奨と違う。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on |
| 2 | マイページの項目をいつメニューに足すか | **Phase 66 で足す**(62 の CONTENTS はダッシュボード・新規プロジェクト作成の2つ) |
| 3 | 最下部へのスクロールの対象 | **チャットを専用の領域にする**(推奨はページ全体を送信欄まで。推奨と違う) |
| 4 | mode なしの作成画面でキャンセルしたら | ダッシュボードへ戻す |

Claude の判断(計画の承認で確定、または作業中):

- 認証の状態が `loading` の間は、Authentication の項目を出さない。TOP は子を持たないリンクのグループにし、トップページのカードからは除く。Guide は `/guide`(開くと 404)。項目の型は `kind` の判別共用体(遷移 / 処理)。
- **ログアウトの形を作業中に改めた**: 計画は「トップページへ遷移してからストアを消す」だった。ブラウザで確かめると、保護ページでログイン必須ダイアログが一瞬出た。そこで、API で失効させてからトップページを読み込み直す形にした([62-1](./Phase-62-1.md))。
- **チャットの完了のバナーを会話の領域の中へ移し、後から届く観点の表にも合わせ直すことにした**(作業中、ブラウザで確かめて): 長いバナーが送信ボタンを画面の外へ押し出し、観点の表が届いて幅が狭まると最後の発言がはみ出したため([62-4](./Phase-62-4.md))。
- ログアウトの処理は素の `<button>` にした(キーボードで押せるように)。
- **Phase 62 完了後の調整**(ユーザーの画面確認の後): 生成済みのプロジェクトで「生成済みのドキュメントを見る」がヘッダーに隠れた。会話の領域の高さを、固定の見積もりから「読み込んだときの配置で、入力欄がページを動かさずに収まる高さ」に改めた([62-4](./Phase-62-4.md#phase-62-完了後の調整-領域の高さを配置から決める))。

推奨と違った選択は1つ(専用の領域)。範囲を広げる向き(レイアウトの変更・追従の処理。#39 の材料)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-62-1.md`](./Phase-62-1.md) | ヘッダーのリンク・ログアウトの処理 | あり(本体 3 + テスト 2) | なし |
| [`Phase-62-2.md`](./Phase-62-2.md) | メニューの組み直しと出し分け | あり(本体 7 + テスト 4) | 62-1(`MenuEntry` が `useLogout` を使う・`Menu.module.css` を続けて更新) |
| [`Phase-62-3.md`](./Phase-62-3.md) | mode なしの作成画面でモードを選ぶ | あり(本体 3 + テスト 3) | なし |
| [`Phase-62-4.md`](./Phase-62-4.md) | チャットの専用の領域と最下部 | あり(本体 1 + テスト 1) | なし |

## サンプルコード一覧

`textbook/samples/frontend/` の新規・更新:

- 62-1: `src/components/layout/Header.tsx`(テンプレート由来で初めて samples に)・`src/components/layout/Menu.module.css`(同)・`src/components/auth/useLogout.ts`(新規)・`src/components/layout/__tests__/Header.test.tsx`(新規)・`src/components/auth/__tests__/useLogout.test.tsx`(新規)
- 62-2: `src/lib/menu-tree.ts`・`src/components/layout/useMenuTree.ts`(新規)・`src/components/layout/MenuEntry.tsx`(新規)・`src/components/layout/HierarchicalMenu.tsx`(テンプレート由来)・`src/app/page.tsx`(同)・`src/components/errors/NotFoundContent.tsx`(同)・`src/lib/__tests__/menu-tree.test.ts`(新規)・`src/components/layout/__tests__/Menu.test.tsx`・`src/components/errors/__tests__/NotFoundContent.test.tsx`(新規)・`src/app/__tests__/page.test.tsx`(新規)
- 62-3: `src/features/dashboard/api/projects.ts`・`src/features/dashboard/components/ModeSelectDialog.tsx`・`src/features/hearing/components/NewProjectPageContent.tsx` とそれぞれのテスト(`src/app/projects/new/__tests__/page.test.tsx` を含む)
- 62-4: `src/features/hearing/components/ChatPanel.tsx`・`__tests__/ChatPanel.test.tsx`
- ブラウザでの確認のスクリプトはジョブの一時フォルダに置き、samples にミラーしない。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 主なファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| [62-1](./Phase-62-1.md) | `Header.tsx`・`useLogout.ts` | タイトルを `/` へのリンクに / 失効の API → トップページを読み込み直す | リンクの先・API を呼ぶ・読み込み直す・ストアを先に消さない・API の失敗でも読み込み直す |
| [62-2](./Phase-62-2.md) | `menu-tree.ts`・`useMenuTree.ts`・`MenuEntry.tsx` | 4グループの木と出し分けの純粋関数 / 状態から木を選ぶ / 項目を描く | 並び・未ログイン / ログイン中 / 復元中・空のグループ・TOP の扱い(サイド・トップ・404)・ログアウトを押す |
| [62-3](./Phase-62-3.md) | `projects.ts`・`ModeSelectDialog.tsx`・`NewProjectPageContent.tsx` | 無い mode は `null` / キャンセルを分ける / `null` ならダイアログ | `null` の場合・キャンセルの呼び分け・作成画面でダイアログとダッシュボードへの戻り |
| [62-4](./Phase-62-4.md) | `ChatPanel.tsx` | 会話の領域・読み込み後の最下部・最下部にいれば追従 | 最下部へ・前の success で動かない・追従と引き戻さない・バナーと観点の表で合わせ直す |

## 写経順序(#23)

章番号順(62-1 → 62-4)。各章の表の順(依存順。#30)に写す。62-2 は `menu-tree.ts` → `useMenuTree.ts` → `MenuEntry.tsx` → 消費者3つの順。

実 import 監査(#15。全 import 文を読んで確かめた): 62-1 の `Header.tsx` → `next/link`・`./Menu.module.css`(既存)、`useLogout.ts` → `apiFetch`(既存)。62-2 の `useMenuTree.ts` → `useAuthStore`・`useHasMounted`(既存)・`MENU_TREE`・`visibleMenuTree`・`MenuAuth`・`MenuGroup`(62-2)、`MenuEntry.tsx` → `useLogout`(62-1)・`MenuItem`(62-2)、消費者3つ → `MenuEntry`・`useMenuTree`・`menuItemKey`・`MenuGroup`(62-2)。62-3 の `NewProjectPageContent.tsx` → `ModeSelectDialog`(既存)・`useRouter`。62-4 の `ChatPanel.tsx` → `FOOTER_HEIGHT`(既存)。前方 import は無い。各章が作成・更新した本体のファイルは、その章のテストが(直接か部品を通して)import する。

## 検証結果

- 章ごとの部分テスト: 各章のテストファイル、成功。
- Phase 完了時の全体テスト(#18): devex-ui **911 件成功**(完了後の調整の後は 914 件)(137 ファイル。`--maxWorkers=4`)。部分テストの途中で `Counter.test.tsx` が並列のタイムアウトで1回落ち、単独では通った(持ち越しの「並列のテストのタイムアウト」と同じ)。devex-api は変えていないので流していない。
- `tsc --noEmit` 成功。`npm run lint`: エラー 0(警告1件は以前からの `streamChat.test.ts`)。
- ブラウザでの確認(Playwright のスクリプト。dev の UI・API。利用者を2人登録した。チャットは API の応答を差し替え、DB を変えずに30発言・観点12件・完了のバナーで見た):
  - タイトルを押すと `/` へ。未ログインのメニューの Authentication はログイン・ユーザー登録。
  - メニューの「新規プロジェクト作成」→ モード選択ダイアログ → キャンセルで `/dashboard`。URL の直打ちでダイアログ → 詳細設計モードを選ぶと `?mode=detailed` のフォーム。
  - ダッシュボードでログアウト → `/` へ、ログイン必須ダイアログは出ない(初めの形では出た)。ログアウトの後の Authentication はログイン・ユーザー登録。
  - チャット: 広い画面(1400×900)で会話の領域が最下部、観点の表が右、完了のバナーが会話の末尾、送信ボタンの下端 828px。狭い画面(390×800)で観点の表が上に畳まれ、送信ボタンの下端 728px(フッターの上)。
- `samples_check.py`(`--ui-since HEAD`): 不一致 0 件・作り忘れ 0 件(一致 678 / 並び順のみ差 8 / 例外 5。「samples のみ」2件は以前からの `change-impact-demo` のルート)。`link_check.py`: 切れ 0 件。
- 実 LLM: 呼んでいない(費用 0)。

## 未消化の申し送り(#37)

Phase 61 から引き継いだもの:

- **ステージ9の計画の残り**(Phase 63〜72): 生成のモデルと Gemini の無料枠(→ 68)・再生成の失敗を画面で知らせていない・段階の作り直しの後に承認できない・テスト仕様書を生成中に画面を開き直す(→ 69)・カードで選ぶと観点の要約が置き換わる・値のカードが論点の一部しか値にしない・要件ごとのテストの書き方が浅い・変更のきっかけを列挙する再生成の設計(→ 70)・実装手順書のゴールと単位の食い違い(PR-7)・DFD のデータストアの書き漏れ・画面の文の変更は、その画面のすべての処理へ届く(→ 71)。
- 持ち越し(触るときに直す): **`test_chat_service.py` の pyright の指摘4件**(Phase 40 から)・**並列のテストのタイムアウト**(Phase 44 から。この Phase でも `Counter.test.tsx` で1回)・**偽 LLM の外部設計書の GET に DF が無い**(Phase 45 から)。
- **Phase 63〜72 の未確定事項**: [61-3](../Phase-61/Phase-61-3.md)「未確定事項」(62 の分は解決)。
- **モデルのカタログの見直し**: `gemini-3.1-flash-lite` は 2027-05-07 以降に終了する。
- **確認メールの送信**: 範囲の外。
- **`users` テーブルの表のずれ**: [内部設計書](../../docs/internal_design.md) 3.2節(触るときに決める。Phase 66 の改名で触る見込み)。
- **ステージ8の振り返りとロードマップの修正・Phase 61 の未コミット**: 外側のリポジトリの変更。コミットはユーザーが行う。

この Phase で生まれたもの:

- **画面確認(#37 の運用注記)**: ヘッダー・メニュー・モード選択は Phase 72 の本番確認でまとめて見る。
- **マイページの項目**: Phase 66 で CONTENTS に足す。
- **ログアウトの後の読み込み直し**: 失効の API が失敗すると、起動時の復元でログインの状態に戻る(サーバーがログアウトしていない状態をそのまま映す)。Phase 63 の印の cookie は、ログアウトで消す(読み込み直す前に消すか、サーバーの応答で消すかを Phase 63 で決める)。
- **セッションの区切りの記録**: Phase 62 は1セッションで行った(計画モードで調査 → 質問1回(4問)→ 計画の承認 → 62-1〜62-4 の実装 → ブラウザでの確認と直し2件 → samples → 教材 → ユーザーの画面確認 → 完了後の調整1件)。

この Phase で解決したもの:

- **チャットの専用の領域の画面確認**(この Phase で生まれたもの): Phase の直後にユーザーが確かめ、高さの上限・観点の表との並びは OK。リンクがヘッダーに隠れる件は完了後の調整で直した([62-4](./Phase-62-4.md#phase-62-完了後の調整-領域の高さを配置から決める))。
- **61-3 の Phase 62 の未確定事項**(メニューの項目の型・ログアウトの後の遷移と失敗の扱い・スクロールの対象): 着手時の相談と [62-1](./Phase-62-1.md)・[62-2](./Phase-62-2.md)・[62-4](./Phase-62-4.md)。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約(回答は求めない)。

1. ログアウトでストアのトークンを先に消すと、保護ページで何が起きるか。読み込み直す前に失効の API を待つのはなぜか。
2. メニューの木に処理(ログアウト)の中身を持たせず、`kind` だけを持たせたのはなぜか。状態の確認中に Authentication の項目をどちらも出さないのはなぜか。
3. `toProjectMode` が「無いなら簡易」をやめたことで、どこに何の責任が移ったか。モードの選択でなくキャンセルだけを `onCancel` に分けたのはなぜか。
4. チャットの読み込み後の最下部への移動で、`success` だけでなく `loading` を見るのはなぜか。観点の表が届くまで合わせ直すのはなぜか。
5. 専用のスクロールの領域にしたとき、ページ全体のスクロールでは要らなかったどんな処理が増えたか(追従・引き戻さない・高さの変化)。

## 次のフェーズ

**Phase 63**: 認証ページの proxy(ログインの印の cookie を login・refresh で付け、logout・401 で消す・`src/proxy.ts` で `/login`・`/register` を `/dashboard` へ)。着手時に自動実装モード(#21)と [61-3](../Phase-61/Phase-61-3.md) の未確定事項(cookie の名前・寿命・401 で消す場所・`matcher`)を決める。ログアウトが読み込み直しになったこと(62-1)を、印を消す時点の判断に入れる。
