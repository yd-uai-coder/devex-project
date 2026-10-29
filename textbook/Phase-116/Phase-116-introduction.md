# Phase 116 導入: 取り込みの画面

## 目的

ステージ14(変更の取り込み)の画面を作る。Phase 113〜115 で API ができた、資料の追加・違いの取り出し・違いから CR の下書き・束の鮮度・規模の「古い」を、開発者が画面で使えるようにする。プロジェクトに「資料」の画面(SCR-013)を置き、資料を足して最新の束と比べた違いを取り出し、選んだ違いから CR の下書きを作って CR の詳細へ移る。あわせて、ステージ13 の振り返りの入力「古い束を基準にした説明」の画面の側として、束が古いときの共通の知らせ(資料・CR の詳細・共有リンクの作成・束の中身)と、規模の表の基準の束と「古い」を出す。効果測定・E2E・本番への反映の手順は Phase 117。

## パイプライン上の位置づけ・前提

```
[Phase 113]  資料の API・束の鮮度(GET .../baselines/{n}/freshness、束の fresh)
[Phase 114]  違いの取り出し(POST/GET .../materials/{mid}/differences・捨てる / 戻す)
[Phase 115]  違いから CR の下書き(POST .../materials/{mid}/change-requests)・baseline_freshness・規模の state
        ▼
[116-1 型・API・ストア]  資料の型・API の包み・群分けと選び方の純粋関数・ストア
[116-2 画面]           資料の一覧・追加(貼り付け / ファイル)・資料のページ・見出しのリンク
[116-3 画面]           違いの取り出し・違いの一覧・選んで CR の下書き・捨てる / 戻す
[116-4 画面]           束が古いときの共通の知らせ・規模の表の基準の束と「古い」・束の一覧の鮮度・画面確認
[116-5 docs]           外部設計 SCR-013・2.17・実装計画 4.1
        ▼
[Phase 117]  効果測定(B-7・セット A/B ×2)・全 E2E(取り込みの spec)・10.8節
```

- **前提として読むもの**: [111-4](../Phase-111/Phase-111-4.md) の Phase 116 の未確定事項、[115-4](../Phase-115/Phase-115-4.md) の「後の Phase への前提」、[外部設計書](../../docs/external_design.md) 2.17節、Phase 111 の見本の Artifact(資料・違いの一覧・CR の下書き・束が古いとき)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `cb49ea4`(Phase 115)、devex-api は `5574538`、devex-ui は `1cac005`(Phase 112)。どれも未コミットの変更なし。開発 DB は `d5a1c7e3f926`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(着手時の決定5)。本体(`devex-ui`)と samples に同じ内容を書いた。devex-api は変えていない。

E2E: この Phase では流さない。ステージ14 の E2E は Phase 117 で既存を含めて全部流す(取り込みの spec を足す)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 116 開始時」。ユーザーの「Phase115を開始する」は、Phase 115 が完了・コミット済みであることを示して確かめ、Phase 116 に読み替えた。質問は計画モードで2回(4問 + 4問)。すべて推奨どおり。

1. **置き場**: 独立のページ(`/projects/{id}/materials` と `/materials/{mid}`)。ほかの画面の見出しに「資料」のリンク。
2. **並び**: 状態で群に分け(未確認を上)、群の中は取り出しの順。種類は色の印。
3. **追加と取り出し**: 分ける(足したら資料のページへ。そこで最新の束と比べて取り出す)。
4. **知らせの案内**: 共通の部品で理由を出し、「段階を最新にしてから、合意済みの版を作り直す →」(作成のフォームを開いた束の一覧へ。古い段階があれば詳細設計へも)。
5. **モード**: on。
6. **規模の表**: 数に「(古い)」を添えて「数えられない」と分け、表の上に基準の束。
7. **束の鮮度**: 束の一覧に鮮度の列、中身に知らせ。
8. **AI の画面確認**: E2E の捨てのプロジェクトで流れ(実 LLM 1〜2回)。題材「トレンド追跡アプリ」は使わない(計画では「見るだけ」としたが、`run-devex-ui` の手順に従い触らなかった)。

**推奨と違った選択は0件**。計画の承認の後の CR(#40)も0件。#39 の材料。

Claude の判断:
- 違いを捨てる・確かめる点を閉じる理由は、一覧の下の入力欄で書く(ダイアログにしない)。確かめる点は「閉じる」と呼ぶ。
- 候補の要件を全部外した違いがあれば作れない(サーバーは `requirement_ids` を全体の集合で扱い、その違いが黙って落ちるため)。
- 取り出した後に束が作られていれば、CR の下書きのボタンを押せない(409 `MATERIAL_DIFFERENCE_OUTDATED` を画面で先に止める)。
- 本文の長さ・ファイルの形式と大きさは、サーバーと同じ上限で送る前に止める。
- 知らせの部品は束の機能(`features/baselines`)に置き、CR の詳細では合意の前だけ出す(判断の後は判断の時点の予測で組むため)。後の束があるだけなら作り直さず最新の束へ案内する。
- 画面確認の後の調整2件([116-4](./Phase-116-4.md) の4節)。

実 LLM: 画面確認で1回(gemini-3.5-flash-lite、151文字の資料。費用は /bin/bash.01 未満の見込み)。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-116-1.md`](./Phase-116-1.md) | 資料の型・API・純粋関数・ストア | 型・API・`materialOps`・ストア・fixture・テスト3本 | なし |
| [`Phase-116-2.md`](./Phase-116-2.md) | 資料の一覧・追加・資料のページ | 部品4つ・ページ2つ・テスト4本 | 116-1 |
| [`Phase-116-3.md`](./Phase-116-3.md) | 違いの一覧と CR の下書き | 部品3つ・テスト2本 | 116-2 |
| [`Phase-116-4.md`](./Phase-116-4.md) | 束の鮮度の知らせ・規模の表(と画面確認の後の調整) | 知らせの部品・テスト1本(ほかは更新) | 116-3 |
| [`Phase-116-5.md`](./Phase-116-5.md) | docs への反映と後の Phase への前提 | なし(実装のファイルを作らない章。#13・#15・#12 の対象外) | 116-1〜116-4 |

## サンプルコード一覧

新規(26):
- 116-1: [`materials/api/types.ts`](../samples/frontend/src/features/materials/api/types.ts)・[`materialsApi.ts`](../samples/frontend/src/features/materials/api/materialsApi.ts)・[`materialOps.ts`](../samples/frontend/src/features/materials/materialOps.ts)・[`materials-store.ts`](../samples/frontend/src/features/materials/materials-store.ts)・[`materialFixtures.ts`](../samples/frontend/src/features/materials/test-utils/materialFixtures.ts)・テスト3本([`materialsApi.test.ts`](../samples/frontend/src/features/materials/api/__tests__/materialsApi.test.ts)・[`materialOps.test.ts`](../samples/frontend/src/features/materials/__tests__/materialOps.test.ts)・[`materials-store.test.ts`](../samples/frontend/src/features/materials/__tests__/materials-store.test.ts))
- 116-2: [`MaterialCreateForm.tsx`](../samples/frontend/src/features/materials/components/MaterialCreateForm.tsx)・[`MaterialList.tsx`](../samples/frontend/src/features/materials/components/MaterialList.tsx)・[`MaterialsPageContent.tsx`](../samples/frontend/src/features/materials/components/MaterialsPageContent.tsx)・[`MaterialDetailContent.tsx`](../samples/frontend/src/features/materials/components/MaterialDetailContent.tsx)・ページ2つ([一覧](../samples/frontend/src/app/projects/[id]/materials/page.tsx)・[資料](../samples/frontend/src/app/projects/[id]/materials/[mid]/page.tsx))・[`resetMaterialsStore.ts`](../samples/frontend/src/features/materials/test-utils/resetMaterialsStore.ts)・テスト4本
- 116-3: [`ExtractionPanel.tsx`](../samples/frontend/src/features/materials/components/ExtractionPanel.tsx)・[`DismissForm.tsx`](../samples/frontend/src/features/materials/components/DismissForm.tsx)・[`DifferenceTable.tsx`](../samples/frontend/src/features/materials/components/DifferenceTable.tsx)・テスト2本
- 116-4: [`BaselineFreshnessNotice.tsx`](../samples/frontend/src/features/baselines/components/BaselineFreshnessNotice.tsx)・テスト1本

更新: frontend 33(各章の表)。#29 のタグは `Phase-116-1`〜`116-4`。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 116-1 | `baselines/api/types.ts`・`baselinesApi.ts` | 束の鮮度の型と読み出し | URL |
| 116-1 | `materials/api/types.ts`・`materialsApi.ts` | 資料の API の型と9つの包み(ファイルは multipart) | メソッド・URL・本文 |
| 116-1 | `materialOps.ts` | 群分け・選べる違い・候補の要件の送り方・取り出し後の作り直し・失敗の文 | 群の順・確かめる点は選べない・外さなければ省く・全部外すと止める |
| 116-1 | `materials-store.ts` | 一覧・資料と違い・最新の束の鮮度・操作の後の読み直し | 呼ぶ順・失敗の文・CR の一覧の鮮度を落とす |
| 116-2 | `materialOps.ts`・`MaterialCreateForm`・`MaterialList`・`MaterialsPageContent` | 一覧と追加(送る前に止める・足したら資料へ) | 足す入力の組み立て・移動・失敗 |
| 116-2 | `MaterialDetailContent`・ページ2つ・見出し5つ | 資料の本文・確かめて消す・ページの params・「資料」のリンク | 消して戻る・無い資料・簡易モードでリンクなし |
| 116-3 | `ExtractionPanel`・`DismissForm`・`DifferenceTable`・`MaterialDetailContent` | 取り出しの回・違いの群・選んで CR の下書き・捨てる / 戻す | 作れないとき3つ・候補を外した本文・作った後の移動 |
| 116-4 | `BaselineFreshnessNotice`・`baselineOps`・`baselines-store`・束の一覧 / 中身 / ページ | 共通の知らせと案内・束の鮮度 | 出さない・作り直し・最新の束へ・判定できない |
| 116-4 | CR の型・`changeRequestOps`・`ScaleTable`・CR の詳細・`ShareLinkPanel`・`ExtractionPanel` | CR・説明書・共有リンクの鮮度、規模の「(古い)」 | 合意の前だけ・作ったリンクの知らせ・古いと数えられないの区別 |

## 写経順序(#23)

章番号順(116-1 → 116-2 → 116-3 → 116-4 → 116-5)。各章の表は依存順(#30)。

実 import 監査(#15): 各章の終わりの本体の写しで、各ファイルの import を読んだ。116-1 の資料の型は同じ章で足した `BaselineFreshnessRead` を、ストアは同じ章の `getBaselineFreshness`・`materialErrorMessage` を使う。116-2 の `materialOps` は 116-1 の `MaterialInput` を、見出しの5つの画面は 116-1 の `materialsHref` を使う。116-3 の `DifferenceTable` は同じ章の `DismissForm` と 116-1 の純粋関数を使い、`ExtractionPanel` は 116-3 の時点では知らせの部品を import しない(116-4 で足した)。116-4 の `BaselineFreshnessNotice` は同じ章の `needsRebuild`・`baselineCreateHref` と 116-1 の `elementLabel` を使う。前方 import は無い。各章のテストが、その章の全ファイルを import する(`MaterialList`・`MaterialCreateForm` は `MaterialsPageContent` の、`BaselineList` は `BaselinesPageContent` のテストで描く。型のファイルは fixture が import する)。

## 検証結果

- devex-ui:
  - 全テスト `npx vitest run --maxWorkers=4`: 222 ファイル・1422 件が通った(画面確認の後の調整を含む)。
  - `npx tsc --noEmit`: 0 件。`npm run lint`: 0 件の誤り(既存の警告1件 `streamChat.test.ts`)。
- AI の画面確認(`run-devex-ui`。[116-4](./Phase-116-4.md) の4節): 資料の一覧 → 追加 → 資料のページ(知らせ)→ 取り出し(実 LLM)→ 違いの一覧 → 2件を選んで CR-4 の下書き → CR の詳細(知らせ・規模の表の「(古い)」)→ 束の一覧(鮮度)→ 束の中身 →「作り直す」→ 作成のフォーム。想定外の誤りなし(`401 POST /auth/refresh`・下書きの無い CR の `404 .../options/draft` は想定どおり)。
- devex-api: 変更なし。
- `textbook/tools/samples_check.py --ui-since HEAD`: 不一致 0・本体のみ 0(一致 1130 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- E2E: 流していない(Phase 117)。

## 未消化の申し送り(#37)

[Phase 115](../Phase-115/Phase-115-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ14 の中で扱うもの**(行き先は [111-4](../Phase-111/Phase-111-4.md)):
- **開発環境での画面確認**: Phase 112 の画面(影響のタブの「反映で変わった所」・確認事項からのリンク・競合の知らせ)と、**この Phase の画面**(資料の一覧・追加・資料のページ・違いの一覧と CR の下書き・束が古いときの知らせ・規模の表の「(古い)」・束の一覧の鮮度)。ユーザーの確認は Phase 117 の開発環境での画面確認でまとめて行う(#37 の運用注記)。AI の画面確認は [116-4](./Phase-116-4.md) の4節。
- **合意済みの内容の中の食い違い**: 題材の外部設計書 2.4・2.6 に CR-6 の後も「TOP10」が残る。Phase 117 で B-7 を作る前に決める。
- **前 → 後を残す前の反映**(P112): 題材の CR-6 など。Phase 117 で題材を使うときに気にする。
- **撤回を変更として挙げる揺れ**(P114): 検査では弾けない → Phase 117 の効果測定の (4) で数え、プロンプトを直すかを決める。
- **説明書の md の1行の追加**(P115): 規模の節に「B-n の設計から数えました」を足したので、既存の CR の説明書も変わる。確認済みの要約は「確かめ直す」になり、共有リンクでは変わった節として出る。開発環境の題材の CR も同じ。Phase 117 で `OPERATIONS.md` 10.8節に、反映の後に本番の説明済みの CR の要約を確かめ直す手順を足す。

**ステージ14 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。マイグレーション `c4e8a1f7b2d6`(P112)・`e7d2b9a4c103`(P113)・`b8f3d6a2e915`(P114)・`d5a1c7e3f926`(P115)は、Phase 117 で 10.8節のステージ14 の分に足す。
- **使われ方を見て決める**: 要約・案の下書きの回数の上限、実 LLM が利用者の `prev_id` を書くか(P105)、実 LLM の段階1 の処理のまとめ(P110)、取り込みの LLM の回数の上限。
- **LLM の案の下書きは両端に寄る**(18.4): 生成の質の候補として持ち越す。
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
- `tagmerge.py` のメソッドの中身を移す変更の扱い(P104)と、import 区間の中の名前の無い追記のタグ(P109)。README の「要手当て」に書いた
- 段階5 の `StrayProcedureTable` と `StrayFunctionTable` の重なり(#17)
- ログインの無い共有リンクの画面でも `POST /auth/refresh` が呼ばれて 401 になる(P108・110)
- `tagmerge.py` が、クラスの docstring の1行の変更を別の位置にも当てた(P113)。メソッドを2つに分ける変更(`create` → `add_draft`)は、新しいメソッドの頭にタグが付かず、関数の呼び出しの引数の末尾への追記にもタグが付かなかった(P115。手で足した)。**(この Phase)** 先頭に import 区間の無かったファイルに import を足すと、区間の直前でなく、ファイル冒頭のコメントアウトの `↓↓` の後に入った(「要手当て(import)」に出た。`change-requests/api/types.ts` を手で直した)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 題材「トレンド追跡アプリ」の B-5・B-6・CR-5・CR-6 と CR-6 の共有リンク(期限 2026-11-08)、E2E の捨てのプロジェクト(Phase 112 で「予約の CR」に CR-2・CR-3 を足した)、題材の資料2件(セット B)とその違い(B-6 と比べたもの。Phase 117 の効果測定は B-7 で取り出し直す)。**(この Phase)** 「予約の CR」(`e2e-cr-1792937864529@example.com`)に、画面確認で資料「定例打ち合わせ 議事録(画面確認)」とその違い6件(実 LLM で1回取り出した)・違い2件から作った CR-4(下書き)を足した。題材「トレンド追跡アプリ」は触っていない。
- **タグ**: devex-api `phase-101`〜`phase-106`・`phase-110`、devex-ui `phase-107`〜`phase-110`(振り返り 18.1 の Q8)。`phase-112`(両方)・`phase-113`〜`phase-115`(devex-api)は、コミットは済んでいるがタグはまだ無い。この Phase は devex-ui に `phase-116`(devex-api は変更なし)。
- **未コミット**: この Phase の分(外側・devex-ui)。コミットはユーザーが行う(#35)。

**この Phase で生まれたもの**(上の各節に入れたもの以外):
- **セッションの区切りの記録**: Phase 116 は1セッションで行った。
  1. ユーザーの「Phase115を開始する」を、Phase 115 が完了・コミット済みであることを示して確かめ、Phase 116 に読み替えた。
  2. 計画モードで、111-4 の Phase 116 の未確定事項・115-4 の前提・外部設計書 2.17節・見本の Artifact・今の CR と束の画面を読み、8問(4問 + 4問)。計画の承認(エージェントは使わず直接調べた)。
  3. 116-1(型・API・純粋関数・ストア)→ 116-2(一覧・追加・資料のページ)→ 116-3(違いの一覧と CR の下書き)→ 116-4(知らせ・規模の表・束の鮮度)。章ごとに本体の写しを取った。全テストの後に AI の画面確認(実 LLM 1回)、見つけた2件を直した。
  4. samples(`tagmerge.py`。手での直し1件)→ docs → 教材・q_a。

**この Phase で解決したもの**:
- **古い束を基準にした説明**(P110・18.3)の画面 → [116-4](./Phase-116-4.md)(判定は P113、知らせと規模の状態は P115)。
- **資料の取り込みの画面が無い**(111-1 の決定1〜3)→ [116-2](./Phase-116-2.md)・[116-3](./Phase-116-3.md)。
## 完了後の調整

- **フォームの「題」を「タイトル」に**(2026-10-29。ユーザーの画面確認): 資料を足すフォームの欄の名前をユーザーが「タイトル」に変え、足せない理由の文も「タイトルを書いてください。」にそろえた([116-2](./Phase-116-2.md) の `MaterialCreateForm.tsx`・`materialOps.ts` とそのテスト。#29 のタグは `Phase-116(完了後の調整)`)。一覧の表の見出し・API の項目名(`title`)・docs の「題」は変えていない。

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 資料を足す操作と違いの取り出しを分けたのはなぜか。取り出しの前に何を見せるか。
2. 違いの一覧を種類でなく状態で分け、群の中を取り出しの順にしたのはなぜか。
3. 画面・API・外部連携の違いの候補の要件を「外した分」で持ち、1つも外さなければ `requirement_ids` を省くのはなぜか。候補を全部外した違いで作らせないのはなぜか。
4. 束が古いときの知らせを1つの部品にし、束の後の CR があるときと、後の束があるだけのときで案内を変えるのはなぜか。CR の詳細で合意の前だけ出すのはなぜか。
5. 規模の表で「(古い)」と「数えられない」を分けて見せると、開発者・クライアントへの説明の何が変わるか。

## 次のフェーズ

**Phase 117**: 効果測定・統合/E2E。束 B-7 を作ってから、ベースラインと同じ資料・正解表(セット A・B)を取り込みに各2回通して数える(実 LLM)。既存を含めた全 E2E(取り込みの spec を足す)・マイグレーションの往復・開発環境での画面確認(Phase 112・116 の画面を含む)・`OPERATIONS.md` 10.8節のステージ14 の分。着手時に、[111-4](../Phase-111/Phase-111-4.md) の Phase 117 の未確定事項と、[116-5](./Phase-116-5.md) の前提を読む。
