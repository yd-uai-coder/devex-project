# Phase-41-3: 見本 ── 変更の影響(md)と画面のデモ

## この章の目的

[41-2](./Phase-41-2.md) で決めた形(処理を軸にたどる・改名は直接の参照元だけ・理由は規則・段階の「古い」の中に要素の印・再生成の候補)を、実装の前に見本で確かめる。md の見本は「変更の影響」の中身を、画面のデモは操作の流れ(変更を選ぶ → 影響の一覧 → 確認済み → 承認し直せる / 表で見る)を示す。新しい種類の画面なので、操作の流れを先に見せて決める([総括の振り返り](../retrospectives/overall-retrospective.md) 11.6 の所見)。デモを見て、影響の一覧の置き場(決定8)を決めた。

自動実装モード: on([introduction](./Phase-41-introduction.md) 参照)。

## この章で作成・更新したファイル

md の見本(samples の対象外):

| パス | 中身 |
|---|---|
| `appendix/change-impact-sample/README.md` | 示し方の規則と、例3つ(機能要件・モジュールの改名・非機能要件) |

画面のデモ(devex-ui 本体と samples に同じ内容。#30 の依存順):

| ファイル | 責務 |
|---|---|
| [`src/features/change-impact/demo/impactModel.ts`](../samples/frontend/src/features/change-impact/demo/impactModel.ts) | 要素・参照・変更の型と、影響のたどり方・今の仕組みの「古い」・段階の印・承認し直し・再生成の候補の純粋関数 |
| [`src/features/change-impact/demo/demoData.ts`](../samples/frontend/src/features/change-impact/demo/demoData.ts) | 仮データ(ベースラインの生成物を縮めた要素と、変更4つ) |
| [`src/features/change-impact/demo/ChangeImpactDemoPageContent.tsx`](../samples/frontend/src/features/change-impact/demo/ChangeImpactDemoPageContent.tsx) | デモ画面(変更を選ぶ・変わったもの・段階の状態・影響の一覧・再生成の候補・段階の表) |
| [`src/app/change-impact-demo/page.tsx`](../samples/frontend/src/app/change-impact-demo/page.tsx) | ルート `/change-impact-demo`(本体は `src/app/(pages)/` 配下) |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | メニューの「開発用」にデモを足す |
| [`src/features/change-impact/demo/__tests__/impactModel.test.ts`](../samples/frontend/src/features/change-impact/demo/__tests__/impactModel.test.ts) | 純粋関数のテスト |
| [`src/features/change-impact/demo/__tests__/ChangeImpactDemoPageContent.test.tsx`](../samples/frontend/src/features/change-impact/demo/__tests__/ChangeImpactDemoPageContent.test.tsx) | 画面の操作のテスト |
| [`src/app/change-impact-demo/__tests__/page.test.tsx`](../samples/frontend/src/app/change-impact-demo/__tests__/page.test.tsx) | ルートのテスト |

あわせて、ステージ6の完了時にユーザーが本体から外したデモのルート(`hearing-points-demo`・`implementation-procedure-demo`)とメニューを、samples からも外した(#21。`menu-tree.ts` は `Phase-40(完了後の調整)：削除` のタグ、ルートのファイルは削除して [Phase 25-2](../Phase-25/Phase-25-2.md)・[33-3](../Phase-33/Phase-33-3.md) のリンクを外した)。本体のメニューは「開発用」の群ごと無くなっていたので、この章でデモ1つだけの群として足し直した。

## md の見本の要点

- **示し方の規則**の表(変わったもの・たどり方・改名・非機能要件・理由・段階の状態・再生成の候補)を先に置き、例はその規則の当てはめにした。
- **例1(FR-011)**: 影響9件。全段階が「古い」だが、段階4(モジュール)には見直す要素が無く、そのまま承認し直せる。ベースラインの正解にあった `clients/ai.py`(再試行を置く層)は示さない理由を書いた。
- **例2(改名)**: 直接の参照元6件。段階4は「古くない」が、同じ段階の中の `api/routes/chats.py` に印が付く(今の仕組みでは見えなかった依存)。
- **例3(NFR-007)**: 横断事項に要件ID を足した後の形。各処理の手順(持ち主の確かめ)には届かないことを明記し、効果測定の見落としとして数える。

## デモの要点

### `impactModel.ts`(意味モデルと純粋関数)

- 型: `DesignElement { key, kind, stage, label, refs }`(stage 0 = 文書、1〜8 = 段階)、`Ref { to, edge }`、`EdgeKind`(要件・画面・トリガー・処理・テーブル・依存・呼び出し・置き場・呼ぶ手順・単位・横断事項の対象 の11種)、`Change { key, kind: "content" | "rename", before, after }`、`ImpactItem { key, path, reason }`、`StageMark { stage, outdated, open, reviewed }`。
- `impactOf(elements, change)`: 参照を逆にした索引を作り、
  1. 直接の参照元を足す。改名ならここで終わる。
  2. 直接の参照元が横断事項なら、その参照元(単位の手順書)まで足す。
  3. 変更が届く処理を決める(変わったのが処理ならそれ自身、文書の要素なら要件・画面・API だけを通ってたどる、テーブル・モジュールならそれを使う CRUD・手順の処理)。
  4. 処理ごとに、処理を参照する要素(モジュールを除く)と、その先の処理ロジック・単位の手順書を足す。
  同じ要素に複数の道があれば短い方を残す。理由は最後の辺の種類から決まる文(`EDGE_REASON`)。
- `outdatedStages(sourceStage)`: 今の仕組みの「古い」(文書の変更なら全段階、段階 N なら N より後ろ)。`stageMarks` は段階ごとに「古いか・見直し・確認済み」を数え、`canReapprove` は「古い かつ 見直しが0」。
- `regenerationTargets`: 段階5・6・8 の要素だけ(部分再生成の対象)。

### `demoData.ts`

ベースラインと同じ生成物(stage6-effect の詳細設計モード)から、F-02・F-03 とその周りを抜き出した。横断事項には、ステージ7で足す予定の `req_ids`(認証 → NFR-007、ログ → NFR-005)を持たせた。変更は4つ(FR-011・NFR-007・F-03・モジュールの改名)。

### `ChangeImpactDemoPageContent.tsx`

上から「変更を選ぶ → 変わったもの(前・後)→ 段階の状態(8つ)→ 影響の一覧 → 再生成の候補 → 段階の表」。一覧の「確認済みにする」で段階の印が減り、見直しが0になると「承認し直せる」。「表で見る」でその段階の表を開き、行を強調する(`aria-current`)。変更を選び直すと、確認済みと強調は消える。

## テスト観点

用語は [Phase 33-3](../Phase-33/Phase-33-3.md) と同じ(SUT = テストの対象、ドライバ = SUT を呼ぶ側、スタブ = SUT が呼ぶ相手の代わり)。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `impactModel.test.ts` | `impactModel.ts` の純粋関数(たどり方・改名・横断事項・テーブル・短い道・「古い」・段階の印と承認し直し・再生成の候補) | テスト関数(仮データ `demoData.ts` と、小さな手書きの要素を入力に呼ぶ) | 不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため |
| `ChangeImpactDemoPageContent.test.tsx` | デモ画面(最初の変更の一覧と候補、確認済み → 承認し直せる、改名 → 直接だけと同じ段階の印、表で見る → 行の強調) | Testing Library の `render` と `userEvent` | 不要 ── 画面は仮データだけを使い、サーバーと通信しないため |
| `page.test.tsx` | ルートがデモの本体を描くこと | Testing Library の `render` | 本体の部品をモック(ルートの責務は本体を置くことだけなので、本体の中身から切り離す) |

確かめること:

- 要件の変更は、それを持つ処理の要素(要約・CRUD・手順・作業単位・処理ロジック・手順書)まで届き、共有のモジュール(`clients/ai.py`)を通って別の処理(F-03)へは広げない。
- 改名は直接の参照元だけ(6件)。非機能要件は横断事項とその手順書だけ。テーブルの変更は、それを使う処理に届く。
- 同じ段階の中の依存(改名の段階4)は、段階が古くならなくても印が付く。見直す要素の無い古い段階は、そのまま承認し直せる。

```sh
cd devex-ui && npx vitest run src/features/change-impact "src/app/(pages)/change-impact-demo" src/components/layout
```

この章が作成・更新したファイルは、すべてテストが import する(`impactModel.ts`・`demoData.ts` はモデルのテスト、`ChangeImpactDemoPageContent.tsx` は画面のテスト、`page.tsx` はルートのテスト)。`menu-tree.ts` は、既存のレイアウトのテスト(`src/components/layout/__tests__/`)が読む(Phase 33-3 と同じ)。
