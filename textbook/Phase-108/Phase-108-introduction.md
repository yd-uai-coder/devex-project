# Phase 108 導入: 共有リンクの画面(クライアント向け。ステージ13)

## 目的

ステージ13(説明とすり合わせ)の8つ目の実装 Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 108 にあたる。

Phase 103・104 で、ログインの要らない公開の API(閲覧・コメント・合意 / 却下)を作り、Phase 107 で、開発者が CR の詳細の共有タブからリンク(`/share/<トークン>`)を作れるようにした。この Phase では、そのリンクを開いたクライアントが見るページ(SCR-012)を devex-ui に作る。クライアントは、アカウントを作らずに説明書(選択肢・規模を含む)を読み、名前を書いてコメントし、案を選んで合意 / 却下する。devex-api は変えない。

- ページと外枠・状態・前回から変わった点・説明書 ── [108-1](./Phase-108-1.md)
- 名前とコメント ── [108-2](./Phase-108-2.md)
- 案の選択と合意 / 却下 ── [108-3](./Phase-108-3.md)

## パイプライン上の位置づけ・前提

```
開発者: CR の詳細(SCR-010)の共有タブでリンクを作る(Phase 107)─┐ URL /share/<トークン>
                                                                   ▼
クライアント: 共有リンクの画面(SCR-012。この Phase)
  外枠(メニューなし)[108-1]
  題・状態・期限・判断の結果[108-1] → 前回から変わった点[108-1] → 説明書(md)[108-1]
  → お名前[108-2] → ご判断(案・理由・合意 / 却下)[108-3] → コメント[108-2]
                                                                   │ 公開の API(Phase 103・104)
                                                                   ▼
開発者: 共有タブのコメントに返信・合意の記録(出どころ = 共有リンク)(Phase 107)
```

- **前提として読むもの**: [Phase 103](../Phase-103/Phase-103-introduction.md)(公開の閲覧・状態・前回から変わった点・回数の上限)・[Phase 104](../Phase-104/Phase-104-introduction.md)(コメント・リンクからの合意・先に押した方で決まる・指紋)・[Phase 107](../Phase-107/Phase-107-introduction.md)(共有タブ・URL の形・合意のダイアログの案)。
- **今の仕組み**(調べて分かったこと):
  - devex-ui にはログインの要らないページが TOP・ログイン・登録・デモしか無く、どれも `AppShell`(開発者向けのメニュー・トップへのリンク・フッター)の中に出る。
  - 公開の閲覧の応答は、説明書を出力の md(`markdown`)で返し、規模・案の中身はその中にある。案は別に、名前・結果・おすすめだけを返す(選ぶため)。
  - 簡易ドキュメントモードのプロジェクトの CR のリンクは、API が 404(リンクが無いのと同じ)を返す。画面に新しい入口は増えない。
  - devex-api の 404 の `detail` は英語("Share link not found")、410・409 は日本語。画面では `code`・`status` から文を決める。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `697f206`、devex-api は `stage11-15` ブランチの `806fee4`(変えていない)、devex-ui は `main` の `55bff5a`(Phase 107 の分。前からの未コミットの変更は無くなっていた)。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。変えるのは devex-ui だけ(devex-api は変えない)。

E2E: この Phase では流さない。今の E2E の画面の流れは変えていない(外枠の変化は `/share/` で始まるパスだけ)。Phase 110 で、共有リンクの流れの spec(開発者がリンクを作り、この画面で閲覧・コメント・合意)を足して全部流す(#36)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 108 開始時」を参照する。計画モードで1回(4問)聞いた。外枠と並びは、Phase 107 と同じく画面のイメージを並べて聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 外枠 | `/share/*` だけクライアント用の素の枠(メニューと開閉ボタンなし、題はリンクにしない、テーマの切り替えは残す)(推奨どおり) |
| 3 | 並び | 1列で上から(状態 → 前回から変わった点 → 説明書 → ご判断 → コメント)(推奨どおり) |
| 4 | 名前 | ページに1つで、このブラウザに覚える(覚えられなくても動く)(推奨どおり) |

Claude の判断(計画の承認で確定、または実装中):

- 読み直しは手で押すだけ(公開の入口の回数の上限のため、自動では読まない)。
- 案のカードは開発者の側の `OptionCards` を使い回さず、ここに書く(型と見せる中身が違う。#17)。状態の色(`SHARE_STATE_TONE`)・コメントの本文の上限(`COMMENT_BODY_MAX`)・型 `ShareState` は開発者の側のものを使う(同じ事実)。
- ページは検索に載せず(`robots`)、外へのリンクで参照元を送らない(`referrer`)。トークンは読む権限そのものだから。
- 合意・却下の前に確かめる(先に押した方で決まり、直せないため)。案は初めは選ばない(開発者の合意のダイアログと同じ)。
- 実装中: 名前の欄は、説明書の後・ご判断の前に1つ置き、開いているリンクだけ出す。判断を押したときにリンクが開いていなかったら、読み直した今の状態の上に断られた旨を出す(ご判断の欄は消えるため、ページの本体で出す)。
- 完了前に、ヘッドレスのブラウザでログインせずに開き、閲覧 → 案を選ばない合意の断り → 確かめ → 合意 → 判断済みの表示 → 存在しないリンクの表示を通した(下の「検証結果」)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-108-1.md`](./Phase-108-1.md) | ページと閲覧(外枠・状態・前回から変わった点・説明書) | あり(本体 11 + テスト 7。新規 16) | なし |
| [`Phase-108-2.md`](./Phase-108-2.md) | 名前とコメント | あり(本体 7 + テスト 5。新規 3) | 108-1(ストア・ページの本体) |
| [`Phase-108-3.md`](./Phase-108-3.md) | 案の選択と合意 / 却下 | あり(本体 6 + テスト 6。新規 2) | 108-2(名前) |

## サンプルコード一覧

`textbook/samples/frontend/src/features/share/`(新しい機能のまとまり)・`src/app/share/[token]/`・`src/components/layout/`。

- 108-1: `api/types.ts`・`api/sharedApi.ts`・`shareOps.ts`・`share-store.ts`・`components/SharedStateNotice.tsx`・`SectionChanges.tsx`・`SharedChangeRequestPageContent.tsx`・`test-utils/*`・テスト3本、`app/share/[token]/page.tsx`・テスト、`components/layout/client-page.ts`・`AppShell.test.tsx`(新規)、`Header.tsx`・`AppShell.tsx`(更新。`AppShell.tsx` はテンプレート由来で samples に無かったので、元の形を置いてから当てた)。
- 108-2: `components/ClientNameField.tsx`・`SharedComments.tsx`・テスト1本(新規)、型・API・純粋関数・ストア・ページの本体ほか(更新)。
- 108-3: `components/SharedDecisionForm.tsx`・テスト1本(新規)、型・API・純粋関数・ストア・ページの本体ほか(更新)。
- 章の終わりごとに本体の形を保存し、新規ファイルは初出の章の形に `作成` のヘッダーを付け、後の章の分は「前の章の終わり → この章の終わり」の差分を `tagmerge.py` で章の順に当てた(Phase 107 と同じ手順)。「要手当て」は出なかった(`Header.tsx` で「旧の行が samples に見つからない」が1件出たが、当たった結果は本体と一致し、`samples_check.py` も一致)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 108-1 | `client-page.ts`・`Header.tsx`・`AppShell.tsx` | クライアントのページの外枠 | `/share/…` でメニュー・トップへのリンク・フッターが無い |
| 108-1 | `page.tsx` | ログインの要らないページと、検索・参照元の扱い | トークンを渡す・`metadata` |
| 108-1 | `types.ts`・`sharedApi.ts`・`shareOps.ts`・`share-store.ts` | 公開の閲覧の型・読み込み・状態と失敗の文 | 状態の文・404 / 410 の分け方・429 は中身を残す |
| 108-1 | `SharedStateNotice.tsx`・`SectionChanges.tsx`・`SharedChangeRequestPageContent.tsx` | 題・状態・判断の結果・変わった点・説明書 | 直している・判断済み・使えないリンクの出し分け |
| 108-2 | 型・API・`shareOps.ts`・ストア | 名前の覚え・コメントの送信・説明書の変化 | 覚えられないブラウザ・指紋を送る・409 で読み直しを促す |
| 108-2 | `ClientNameField.tsx`・`SharedComments.tsx`・ページの本体 | 名前の欄とコメント欄 | 書けない状態で欄が無い・送れなければ本文を残す |
| 108-3 | 型・API・`shareOps.ts`・ストア | 判断の確かめと送信・断られたときの読み直し | 案・理由の確かめ・却下で案を送らない・先に判断されていた |
| 108-3 | `SharedDecisionForm.tsx`・ページの本体 | 案の選択・合意 / 却下・記録の前の確かめ | 初めは選ばない・確かめでやめる・並び |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30。外枠 → 型 → API → 純粋関数 → ストア → 部品(使われる側が先)→ ページ → テスト。テスト用の準備はテスト群の先頭)。

実 import 監査(#15)として、新規ファイルと、更新したファイルの足した import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。章の終わりごとに保存した本体の形で、その章までのテストが通ることも確かめている。

- `AppShell.tsx`(108-1)→ `isClientPage`(108-1)、`Header` の `plain`(108-1)。`page.tsx`(108-1)→ `SharedChangeRequestPageContent`(108-1)。
- `sharedApi.ts`(108-1)→ `SharedChangeRequestRead`(108-1)。`shareOps.ts`(108-1)→ `ShareState`(既存。Phase 107)・`ApiError`(既存)。ストア(108-1)→ `getSharedChangeRequest`・`isLinkUnavailable`・`shareFailureMessage`(108-1)。`SharedStateNotice.tsx`(108-1)→ `SHARE_STATE_TONE`(既存。Phase 107)・`formatDate`・`formatDateTime`・`stateNotice`(108-1)。`SharedChangeRequestPageContent.tsx`(108-1)→ `MarkdownBody`(既存)。
- 108-2: `sharedApi.ts` → `SharedCommentCreate`・`SharedCommentRead`(108-1・108-2)。ストア → `postSharedComment`・`isExplanationChanged`・`loadClientName`・`saveClientName`(108-2)。`ClientNameField.tsx` → `CLIENT_NAME_MAX`(108-2)。`SharedComments.tsx` → `nameProblem`・`isWritable`(108-1・108-2)・`COMMENT_BODY_MAX`(既存。Phase 107)。ページの本体 → `ClientNameField`・`SharedComments`(108-2)・`isWritable`(108-1)。
- 108-3: `sharedApi.ts` → `SharedDecisionCreate`(108-3)。ストア → `postSharedDecision`・`isNotWritable`(108-3)。`SharedDecisionForm.tsx` → `DECISION_REASON_MAX`・`decisionProblem`(108-3)・`ConfirmDialog`(既存)。ページの本体 → `SharedDecisionForm`(108-3)。
- テスト: 各章のテストは、その章までの fixtures の関数(`makeShared`・`makeHiddenShared`・`FINGERPRINT` 108-1・`makeSharedWithOptions` 108-3)だけを使う。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。108-1 は `shareOps.test.ts`・`share-store.test.ts`(API・型は経由)・`SharedChangeRequestPageContent.test.tsx`(`SharedStateNotice`・`SectionChanges`)・`page.test.tsx`・`AppShell.test.tsx`(`client-page`・`Header`)。108-2 は `SharedComments.test.tsx`・`SharedChangeRequestPageContent.test.tsx`(`ClientNameField`)・ストアと純粋関数のテスト。108-3 は `SharedDecisionForm.test.tsx`・`SharedChangeRequestPageContent.test.tsx`・ストアと純粋関数のテスト。

## 検証結果

- ユニット: 章ごとに `src/features/share`・`src/app/(pages)/share`・`src/components/layout` のテストを流した(最後は share の 39 件)。
- devex-ui: `npx tsc --noEmit`: 0 件。`npm run lint`: エラー 0(警告は既存の `streamChat.test.ts` の1件だけ)。全体テスト `npx vitest run --maxWorkers=4`: 208 ファイル・1330 件がすべて通った。
- devex-api: 変えていないので流していない。
- `textbook/tools/samples_check.py --api-since 806fee4 --ui-since 55bff5a`: 不一致 0・本体のみ 0(一致 1063 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- ヘッドレスのブラウザ(run-devex-ui の手順。ログインはしない): E2E が残した捨てのプロジェクト(`e2e-cr-1792586762956@example.com` の「予約の CR」)の CR-2(説明済み・案つき。Phase 107 の確認で作ったもの)に API で共有リンクを作り、`/share/<トークン>` を開いた。説明書・案のカード・お名前・コメントが描け、メニューは無く、ページの題は「変更のご相談 | Devex」。コメントを1件送り、案を選ばずに合意を押すと断られ、案1 を選んで確かめ → 記録で判断済み(合意・選んだ案・判断した人・記録: 共有リンク)になった。存在しないトークンは「このリンクは見つかりません」。想定外のブラウザの誤りは無かった(出たのはログイン前の `401 POST /auth/refresh` と、存在しないトークンの `404` だけ)。**このプロジェクトの CR-2 は、共有リンクからの合意で「合意」になった**(捨てのプロジェクト。トレンド追跡アプリは触っていない)。
- 実 LLM: 使っていない(費用 0)。E2E: 流していない(Phase 110)。開発環境での画面確認: 上のヘッドレスの確認だけ(#37 の運用注記で Phase 110 にまとめる。申し送り参照)。

## 未消化の申し送り(#37)

[Phase 107](../Phase-107/Phase-107-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ13 の中で扱うもの**(行き先は [100-4](../Phase-100/Phase-100-4.md)):
- **コメントの削除・編集**(P104)→ Phase 109〜110 の画面確認で、要るかを決める(開発者の側もクライアントの側も作っていない)。
- **段階2・3・7 の機能一覧に無い処理の一覧**(P106)→ Phase 109。そのまま。
- **確認事項の「CR-n で変わった」の表示**(P106)→ Phase 109。そのまま。
- **起点の欄の処理**(P106)→ Phase 109。devex-ui の `ORIGIN_KIND_LABEL` にはまだ `function` が無い。
- **束の一覧の入れた CR**(P106)→ Phase 109。そのまま。
- **束の段階が古いと、予測が少なく出る**(P100)→ Phase 110 の新しい CR の前に決める(残す)。
- **Phase 110 の新しい CR の題材**: 選択肢が自然に2つ以上ある変更(100-4)。下書きを実 LLM で作るなら、費用の見積もりを計画に出す。E2E に共有リンクの流れの spec を足す(Phase 107 の共有タブでリンクを作り、この Phase の画面で閲覧・コメント・合意)。この Phase の確認で使った locator の注意: 確かめのダイアログは `getByRole("dialog", { name: … })` で絞る(Tamagui の `Dialog` は `<dialog>` の外枠と `role="dialog"` の中身の2つに当たる)。
- **言い換えの E2E の spec**(P105)→ Phase 110。そのまま。
- **実 LLM が利用者の `prev_id` を書くか**(P105)→ Phase 110 の効果測定。そのまま。
- **Phase 107 の画面確認** → Phase 110 の開発環境での画面確認でまとめて行う。見るもの: 内容タブの選択肢の節と規模の表(案ごとの列の幅)・案の編集欄の長さ・合意のダイアログの案・下書きの枠・共有タブ(URL の枠・一覧・ダイアログの文)・コメント欄。
- **この Phase の画面確認**(この Phase で生まれた)→ Phase 110 でまとめて行う。見るもの: スマートフォンの幅での並び(案のカード・名前の欄の幅)・直している / 期限切れ / 取り消しの表示・前回から変わった点の枠(長い節のとき)・判断済みの結果の枠・暗いテーマ。ヘッドレスの全体の撮影では、固定のヘッダーがページの途中に写る(撮影の仕方による。画面の不具合ではない)。画面確認の後の調整は通常の工程(#38)。
- **効果測定の読み方**: Phase 110 は、クライアント役がこの画面(説明書の md と案のカード)で読む。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `a7c3e5d91f20`(P102)・`c5d8e2f4a613`(P103)・`d7e1f3a5b802`・`e8f2a4b6c913`(P104)・`f3b7d9a2c514`・`a9c2e4f6b318`(P106)を 10.8節に入れる(Phase 110)。Phase 101 の説明書の md の変化で以前の要約がすべて「古い」になること、本番の `.env` に共有リンクの上限を置かないこと、確認事項の古いキーの付け直し(P105)、巡回で消えた版の戻しは反映より前の分は戻らないこと(P106)も 10.8節に書く(Phase 110)。この Phase はマイグレーションが無い。本番の nginx が `/share/…` を devex-ui に渡すこと(ほかのページと同じ経路のはず)は、反映のときに確かめる。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)。この Phase も全体テストは `--maxWorkers=4` で流した。
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)と、メソッドの中身を移す変更の扱い(P104)。P105〜P107 と同じく「章の終わりごとに本体の形を保存し、前の章の終わりからの差分を章の順に当てる」を使った(新規ファイルは初出の章の形に `作成` のヘッダーを付けてから当てる)。手での振り分けは0件。手順に書くかは振り返りで決める。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(この Phase で、捨てのプロジェクトの CR-2 に共有リンクを作り、合意した)。「トレンド追跡アプリ」は Phase 110 の効果測定の題材なので残す(触っていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples・q_a)・devex-ui。devex-api のタグ `phase-101`〜`phase-106`、devex-ui のタグ `phase-107`・`phase-108` は未作成(作ってあれば不要)。コミットはユーザーが行う(#35)。
- **前の Phase のコミットの題**: 外側 `1da37ba`・devex-api `6209bd7` の題の件(P106)。そのまま。

**この Phase で解決したもの**:
- **クライアントの画面**(P103・P104・P107)→ [108-1](./Phase-108-1.md)〜[108-3](./Phase-108-3.md)。
- Phase 108 の未確定事項(100-4。共有リンクの画面の見た目とクライアントに見せない情報の範囲)→ 「着手時の相談で決めたこと」。見せる情報は API が決めた範囲(説明書・案・判断の結果・コメント)のままで、画面は内部の ID を足さない。

**この Phase で生まれたもの**:
- 上の「この Phase の画面確認」。
- **セッションの区切りの記録**: Phase 108 は1セッションで行った。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(4問。外枠と並びは画面のイメージつき)・計画の承認
  2. 108-1〜108-3 の実装とテスト(章の終わりごとに本体の形を保存)
  3. 全体テスト・lint・型
  4. ヘッドレスのブラウザでの確認(ログインなし)
  5. samples(`tagmerge.py` を章の順に当てる)
  6. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. クライアントのページで、開発者向けのメニューとトップへのリンクを出さないのはなぜか。外枠の判断をパスの頭で行う純粋関数にしたのはなぜか。
2. ページを検索に載せず、参照元を送らないのはなぜか。
3. 404 と 410(期限切れ・取り消し)を分けて伝え、読み直しのボタンを出さないのはなぜか。429 では読んだ中身を残すのはなぜか。
4. 名前をこのブラウザに覚えても、覚えられないときに失敗にしないのはなぜか。覚えるのを名前だけにしたのはなぜか。
5. 合意の前に確かめ、案を初めは選ばないのはなぜか。押したときにリンクが開いていなかったら、読み直してから断られた旨を出すのはなぜか。
