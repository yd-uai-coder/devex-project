# Phase 110 導入: 効果測定・統合/E2E・画面確認(ステージ13 の最後)

## 目的

ステージ13(説明とすり合わせ)の最後の Phase。[100-4](../Phase-100/Phase-100-4.md) の Phase 110 として、Phase 101〜109 で作った規模・選択肢・共有リンク・コメントと共有リンクからの合意・言い換えの偽 LLM・残りの画面を、[ベースライン](../../appendix/measurements/stage13-baseline.md)と同じ題材とクライアント役の規則で測り直し、マイルストーン14 を判定する。

- クライアント役が共有リンクの画面(と説明書の md)で読む効果測定 ── [110-1](./Phase-110-1.md)
- 共有リンクの流れ・言い換えの E2E を足し、既存を含めて全部流す(#36)── [110-2](./Phase-110-2.md)
- マイグレーションの往復と、`OPERATIONS.md` 10.8節のステージ13 の分 ── [110-3](./Phase-110-3.md)
- 実 LLM の流れと画面確認(Claude のヘッドレス)── [110-4](./Phase-110-4.md)

本番への反映は、この Phase では行わない(ステージ15 の完了時。#37 の運用注記)。

## パイプライン上の位置づけ・前提

```
ステージ13(Phase 100〜110)
  100 仕様診断・ベースライン(CR-3 は合意、CR-4 は判断できない)
  101〜106 API(規模・選択肢・共有リンク・コメントと合意・言い換えの偽 LLM・参照の切れ)
  107〜109 画面(CR の画面・共有リンクの画面・残りの画面)
  110 ── 効果測定(同じ規則で CR-3・CR-4・CR-6)                 ──[110-1]
         共有リンクの流れ・言い換えの E2E + 既存の全 E2E           ──[110-2]
         マイグレーションの往復・10.8節(ステージ13 の分)          ──[110-3]
         実 LLM の流れ・画面確認(ヘッドレス)                      ──[110-4]
         └ ユーザーの画面確認の指摘 → Phase 完了後の調整
  └→ ステージ14・15 → ステージ15 の完了時に本番へ(10.8節)
```

- **前提として読むもの**: [ベースライン](../../appendix/measurements/stage13-baseline.md)・[クライアント役の規則](../../appendix/measurements/stage13/client.md)・[100-1](../Phase-100/Phase-100-1.md)(決定4)、共有リンク([Phase 103](../Phase-103/Phase-103-introduction.md)・[104](../Phase-104/Phase-104-introduction.md)・[108](../Phase-108/Phase-108-introduction.md))、言い換え([Phase 105](../Phase-105/Phase-105-introduction.md))、前のステージの最後の Phase([Phase 99](../Phase-99/Phase-99-introduction.md)。E2E の流し方・往復・手順の形)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `81065ec`、devex-api は `stage11-15` の `806fee4`、devex-ui は `main` の `27253d0`(どれもコミット済み)。alembic の head は `a9c2e4f6b318`。題材は段階1〜8 が承認済み(ただし段階6〜8 は CR-4 の後で古い)、要件定義書 v12、CR-1〜4(CR-3・CR-4 は反映済み)、束 B-1〜B-4。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。測定・往復・画面確認の章では、本体のコードは変えない。本体に足したのは E2E の spec 2本と、既存の spec 1本の直しだけ。画面確認の指摘は「Phase 完了後の調整」で直す。

E2E: **この Phase で既存を含めて全部流す**。spec を2本足した([110-2](./Phase-110-2.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 110 開始時」を参照。計画モードで1回(4問)と、ログインの方法を1問聞いた。実施中に1回(1問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on・測定では本体を変えない(推奨どおり) |
| 2 | 反映済みの CR-3・CR-4 の読み方 | 説明書の md を書き出して読む(推奨どおり) |
| 3 | 選択肢のある新しい CR の題材 | 件数のずれ(表示は TOP20、取得と解説は10件)を直す。今の段階で束を作って基準にする(推奨どおり) |
| 4 | 操作と実 LLM の範囲 | **すべて Claude がヘッドレスで**(推奨は「開発者側はユーザー」) |
| 5 | ログイン | 開発用の固定の利用者(`seed.py` のとおり) |
| 6 | (実施中)B-5 の段階7・8 が古く CR-5 の規模が0件 | 段階7 を直して B-6 から作り直す(推奨どおり。CR-5 は取り下げ、CR-6) |

推奨と違った選択は1件(決定4)。#39 の材料。

Claude の判断:
- 測定のスクリプトは、ベースラインの `measure.py` を番号を引数で受ける形に直して使い、ベースラインの書き出しは上書きしない。
- 段階6 は飛ばした(関数の詳細が CR-4 の前の手順を指していた。任意の段階)。段階7 は手の付け替えでは済まず、「CR-4 で作り直す」にした。段階8 の「最重要の未定義」5件は、手順書の中の実装の詳細の決めごとなので、そのまま承認した。
- 案の LLM の下書きのおすすめと文は直さず、足りない中間の案だけを足した(下書きの質も測定の一部にするため)。
- 既存の CR の流れの spec の失敗は、本体でなく spec の側の古さ(同じ名前のボタンが2つ)なので、spec をタブの中に絞った。
- 測定のスクリプトと `OPERATIONS.md` は samples に写さない(#21)。

## 章一覧

| 章 | トピック | 依存 | 実装ファイル |
|---|---|---|---|
| [110-1](./Phase-110-1.md) | 効果測定(クライアント役) | Phase 101〜109 | 無し(`appendix/` の測定だけ。#13/#15 の対象外) |
| [110-2](./Phase-110-2.md) | 共有リンクの流れ・言い換えの E2E と全 E2E | Phase 105・107・108 | `e2e/share-link-flow.spec.ts`・`e2e/paraphrase-flow.spec.ts`(新規)、`e2e/change-request-flow.spec.ts`(更新) |
| [110-3](./Phase-110-3.md) | マイグレーションの往復と 10.8節 | Phase 102〜104・106 のマイグレーション | 無し(インフラの文書。#13/#15 の対象外) |
| [110-4](./Phase-110-4.md) | 実 LLM の流れと画面確認 | 110-1〜110-3 | 無し(操作と確認の記録) |

## サンプルコード一覧

- 110-2: [`frontend/e2e/share-link-flow.spec.ts`](../samples/frontend/e2e/share-link-flow.spec.ts)(新規)・[`frontend/e2e/paraphrase-flow.spec.ts`](../samples/frontend/e2e/paraphrase-flow.spec.ts)(新規)・[`frontend/e2e/change-request-flow.spec.ts`](../samples/frontend/e2e/change-request-flow.spec.ts)(更新)
- samples に写さないもの: [`appendix/measurements/stage13/measure.py`](../../appendix/measurements/stage13/measure.py)(測定)・[`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(インフラの文書)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作るもの | 責務 | テスト観点 |
|---|---|---|---|
| 110-1 | `measure.py` の直し・`stage13-effect.md` | 説明書の書き出しと、クライアント役の判断の記録 | 2回流して同じ出力。マイルストーン14 を CR ごとに判定できる |
| 110-2 | `share-link-flow.spec.ts` | 案 → 共有リンク → クライアントの閲覧・コメント・合意 → 開発者の出どころと返信 | SUT = 画面 + API、ドライバ = Playwright(2つの文脈)、スタブ = 偽の LLM |
| 110-2 | `paraphrase-flow.spec.ts` | 言い換えの再生成でも、処理 ID・合意・外部連携の1行・確認事項のメモが保たれる | SUT = 画面 + API、ドライバ = Playwright、スタブ = 言い換える偽の LLM |
| 110-3 | 10.8節 | ステージ13 の分(6本・確認の表・ロールバック) | 複製 DB の2往復で、既存の表の行の数が変わらず、head が戻る |
| 110-4 | 操作と確認の記録 | 実 LLM の流れ・Phase 107〜109 の画面確認の項目 | Claude がヘッドレスで見る |

## 写経順序(#23)

章番号順。本体のファイルは 110-2 の spec だけ(依存順 #30: どれも `e2e/helpers.ts` だけを import する)。

実 import 監査(#15): 新しい spec 2本の import は `@playwright/test` と `./helpers`(`completeHearing`・`createProject`・`registerAndLogin`)だけで、どれも以前の Phase にある。直した spec の import は変えていない。

## 検証結果

- 110-1: `measure.py 3 4 6` を2回流して同じ出力。`ruff check` は通った。
- 110-2: 新しい spec は spec の側の誤り3つを直して通った。既存の CR の流れの spec の locator を直した後、全 E2E は **13件成功** を2回。devex-ui の `tsc --noEmit` と、`e2e/` の `eslint` は通った。
- 110-3: 複製 DB で6本の downgrade → upgrade を2往復し、既存の表の行の数は変わらなかった。
- `samples_check.py --api-since 806fee4 --ui-since 27253d0`: 不一致 0・本体のみ 0(一致 1067 / 並び順のみ差 8 / 例外 5)。
- `link_check.py`: リンク切れ 0 件。
- devex-api・devex-ui のユニットは流していない(本体のコードを変えていない。spec だけ)。
- 実 LLM: 13回・概算 約 $0.04([110-4](./Phase-110-4.md))。

## 未消化の申し送り(#37)

[Phase 109](../Phase-109/Phase-109-introduction.md#未消化の申し送り37) から引き継いだもの。

**この Phase の後の状態**:
- 題材の後の状態: CR-6 は反映済みで検証の前(段階2〜8 に見直しの印35件。段階2 に F-32・F-33 の機能一覧に無い処理)。画面確認でそのまま見られる。

**ステージ13 の範囲の外**:
- **使い勝手(主に UI)の見直し**: ステージ13 の後に回す。
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。ステージ13 の分は、この Phase で 10.8節に書いた(6本・確認の表・ロールバック・反映の後に変わって見えるもの)。本番の `/share/…` の届き方は反映のときに確かめる。
- **要約・選択肢の下書きの生成の回数の上限**: 使われ方を見て決める。
- **古い束を基準にした説明**(この Phase で生まれた。マイルストーン14 の読み替えの CR で、ステージ14 以降へ送ると決めた): 古い束が基準の CR は、規模が「数えられない」と出てクライアントが決められない(CR-3・CR-4)。段階が古いだけで切れた参照は「0件(少なく出ることがある)」と出て、クライアントには0件に見える(CR-5)。案: 束を作り直してから説明する運用を手順に書く、古い束を基準にした CR を説明済みにするときに知らせる。
- **実 LLM が利用者の `prev_id` を書くか**(P105): この Phase では記録から分からなかった(版の model は付けた ID だけを持つ)。確かめるなら、生成の出力を残す仕組みが要る。使われ方を見て決める。
- **実 LLM の段階1 の処理のまとめ**(この Phase で生まれた): 段階1 の作り直しで、2つのバッチを1つにまとめた(F-32・F-33 → F-34)。下流の付け替えは Phase 109 の一覧で行える。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 100 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(Phase 80 から)
- 反映の後の CR の流れの部品・束の写しの取り出し(#17。触るときに寄せる)
- `tagmerge.py` の、複数の章が触るファイルの章の振り分け(振り返り 17.7)・メソッドの中身を移す変更の扱い(P104)・`"use client"` の後のヘッダー(P109)。手順に書くかは振り返りで決める。この Phase の spec の直しは1回で当たった。
- 段階5 の `StrayProcedureTable` と `StrayFunctionTable` の重なり(#17)。
- ログインの無い共有リンクの画面でも `POST /auth/refresh` が呼ばれて 401 になる(想定どおりだが、PROBLEMS に毎回出る)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」に、この Phase で束 B-5・B-6、CR-5(取り下げ)・CR-6(反映済み)、CR-6 の共有リンク(開いたまま。期限 2026-11-08)とコメント・返信、段階6 の飛ばし、段階7・8・テスト仕様書・段階1 の作り直しと承認を足した。E2E の捨てのプロジェクト(`e2e-share-1792934834252@example.com` の「予約の共有」)に CR-2 と共有リンク2本(取り消し・期限切れ)を作った。E2E が残した利用者・プロジェクトは今までどおり。
- **この Phase の未コミット**: 外側のリポジトリ(教材・測定・q_a・docs・samples)・devex-api(`OPERATIONS.md`)・devex-ui(spec 3本と、調整の本体4・テスト4)。タグ `phase-110`(devex-api・devex-ui)。前の Phase のタグ(devex-api `phase-101`〜`phase-106`、devex-ui `phase-107`〜`phase-109`)は未作成なら作る。コミットはユーザーが行う(#35)。
- **前の Phase のコミットの題**: 外側 `81065ec`・devex-ui `27253d0` は Phase 109 の分だが、題が Phase 108 と同じ。そのまま(外側 `1da37ba`・devex-api `6209bd7` と同じ件)。

**この Phase で解決したもの**:
- **マイルストーン14 の判定**(この Phase で生まれた)→ 達成。題材を「ステージ13 の流れで作った CR」に読み替えた(ユーザーの決定。#40 の CR は [`q_a.md`](../q_a.md) の「Phase 110 開始時」。[`stage13-effect.md`](../../appendix/measurements/stage13-effect.md))。
- **画面確認の指摘**(110-4 の4件)→ 「Phase 完了後の調整」で直した。
- **コメントの削除・編集**(P104)→ 作らない。書いたとおりに残す(ユーザーの決定。[外部設計書](../../docs/external_design.md) 2.16節)。
- **言い換えの E2E の spec**(P105)→ [110-2](./Phase-110-2.md)。
- **共有リンクの流れの E2E の spec**(P107・P108)→ [110-2](./Phase-110-2.md)。
- **Phase 110 の新しい CR の題材**(100-4)→ CR-6(件数のずれ・3案)。[110-4](./Phase-110-4.md)。
- **束の段階が古いと、予測が少なく出る**(P100)→ 新しい CR の前に、段階を最新にして束を作り直す(B-6)。[110-1](./Phase-110-1.md)。説明の扱いは上の「古い束を基準にした説明」へ。
- **効果測定の読み方**(P109)→ CR-6 は共有リンクの画面、CR-3・CR-4 は md。[110-1](./Phase-110-1.md)。
- **Phase 107〜109 の画面確認**(Claude のヘッドレス)→ [110-4](./Phase-110-4.md)。ユーザーの画面確認は上に残す。
- **10.8節のステージ13 の分**(P101〜P108)→ [110-3](./Phase-110-3.md)。

**この Phase で生まれたもの**:
- マイルストーン14 の読み替え(CR)・古い束を基準にした説明・段階1 の処理のまとめ・`/auth/refresh` の 401。
- **セッションの区切りの記録**: Phase 110 は1セッションで行った(ユーザーの画面確認と調整は、この後)。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(4問)+ログインの1問・計画の承認
  2. マイグレーションの往復(複製 DB)
  3. E2E の spec 2本・3100 番で全 E2E(既存の spec の直し)・環境を戻す
  4. 実 LLM の流れ(ヘッドレス。途中で1問聞き、段階を最新にして B-6・CR-6)
  5. 画面確認(ヘッドレス)
  6. 効果測定・10.8節・samples・教材・docs
  7. (同じセッションで)ユーザーの決定を受けて「Phase 完了後の調整」・全 E2E をもう一度

## Phase 完了後の調整

[110-4](./Phase-110-4.md) のヘッドレスの画面確認の指摘と気づきを、ユーザーの決定で直した(#38)。コメントの削除・編集は作らず、書いたとおりに残す(ユーザーの決定)。samples のタグは `Phase-110(完了後の調整)`。

| 指摘 | 直し方 |
|---|---|
| スマートフォンの幅で、説明書の表が枠からはみ出して切れる | `MarkdownBody` の表を横に送れる入れ物に入れ、セルの長い語(ファイルのパスなど)を折り返す。枠に `minWidth={0}` |
| 説明書の大見出しが大きく、題が何行にもなる | 狭い画面だけ、題(h1)と節の見出し(h2)を1段ずつ小さくした(`$md` で今までの大きさ)。広い画面は変わらない(40px・30px) |
| 開発者の規模の表で、案ごとの列が広く、数が項目の名前から遠い | 内訳の列が無い(案ごとの)表は内容の幅にし、縦並びの入れ物で伸ばされないよう左に寄せた |
| 取り込んだ直後の下書きに「作った後に説明書が変わりました」 | 取り込み済みの下書きには出さない(純粋関数 `draftStaleNotice`)。取り込みで CR の案が変わり、説明書が変わるため |

作成・更新したファイル(依存順 #30):

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/src/features/documents/components/MarkdownBody.tsx`](../samples/frontend/src/features/documents/components/MarkdownBody.tsx) | 更新 | 表の入れ物・セルの折り返し・狭い画面の見出し |
| [`frontend/src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `draftStaleNotice` |
| [`frontend/src/features/change-requests/components/OptionDraftReview.tsx`](../samples/frontend/src/features/change-requests/components/OptionDraftReview.tsx) | 更新 | 古い知らせを `draftStaleNotice` で出し分ける |
| [`frontend/src/features/change-requests/components/ScaleTable.tsx`](../samples/frontend/src/features/change-requests/components/ScaleTable.tsx) | 更新 | 案ごとの表を内容の幅に |
| [`frontend/src/features/documents/components/__tests__/MarkdownBody.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/MarkdownBody.test.tsx) | 新規 | 表の入れ物と折り返し・名前つきの枠 |
| [`frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | `draftStaleNotice` の3通り |
| [`frontend/src/features/change-requests/components/__tests__/OptionDraftReview.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/OptionDraftReview.test.tsx) | 更新 | 取り込み済みで古い下書きに知らせが出ない |
| [`frontend/src/features/change-requests/components/__tests__/ScaleTable.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ScaleTable.test.tsx) | 更新 | 1列の表は全幅、案ごとの表は内容の幅で左寄せ |

テスト観点(#14):
- `MarkdownBody.test.tsx`: SUT = `MarkdownBody`、ドライバ = Testing Library(描画)。スタブ不要 ── md の文字列を受け取って描くだけで、ストアも API も呼ばないため。
- `changeRequestOps.test.ts`: SUT = `draftStaleNotice`、ドライバ = テスト関数。スタブ不要 ── 純粋関数のため。
- `OptionDraftReview.test.tsx`: SUT = `OptionDraftReview`、ドライバ = Testing Library。スタブ = ストアの関数(既存と同じ)。
- `ScaleTable.test.tsx`: SUT = `ScaleTable`、ドライバ = Testing Library。スタブ不要(既存と同じ)。

実 import 監査(#15): `OptionDraftReview.tsx` → `draftStaleNotice`(表の上側)。`changeRequestOps.ts` → `OptionDraftRead`(以前の Phase の型)。ほかは import を変えていない。各テストは、調整で作成・更新したファイルを少なくとも1度 import する。

検証:
- devex-ui: `tsc --noEmit` 0件。`lint` はエラー 0(警告は既存の1件だけ)。ユニット 210ファイル・1353件がすべて通った(`--maxWorkers=4`)。`build` も通った。
- 開発サーバーで、共有リンクの画面(375px)の表が枠に収まり(説明書の11の表すべて、はみ出し 0)、ページの横の送りが無いこと、見出しが 30px・26px(広い画面は 40px・30px のまま)、開発者の案ごとの規模の表が内容の幅になったことを、ヘッドレスで確かめた。
- 全 E2E を、110-2 と同じ流し方でもう一度2回流し、2回とも **13件成功**。環境は元に戻した。
- `samples_check.py --api-since 806fee4 --ui-since 27253d0`: 不一致 0・本体のみ 0(一致 1068)。`link_check.py`: 0件。`MarkdownBody.tsx` の samples は、ヘッダーが `"use client"` の後にあるため `tagmerge.py` が1行目に新しいヘッダーを足した(P109 と同じ件)。手で1行にまとめた。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 反映済みの CR-3・CR-4 を、共有リンクの画面でなく説明書の md で読んでよいのはなぜか。
2. ベースラインで合意できた CR-3 が、今の説明書では判断できなくなったのはなぜか。それは後退か。
3. B-5 を基準にした CR-5 の規模が0件になったのはなぜか。「数えられない」とどう違って見えるか。
4. 言い換えの E2E で、段階1 の言い換えを合意の前の再生成の後に確かめるのはなぜか。
5. CR の流れの既存の spec が失敗したとき、本体でなく spec を直したのはなぜか。
