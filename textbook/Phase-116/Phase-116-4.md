# Phase-116-4: 束の鮮度の知らせ・規模の表

## この章の目的

Phase 113・115 の「束が古い」の判定を画面に出す。1つの知らせの部品を、資料のページ(取り出しの前)・CR の詳細(合意の前)・共有リンクを作った後・束の中身に置き、束を作り直す画面へ案内する。規模の表は「古い」と「数えられない」を分け、どの束から数えたかを出す。束の一覧に鮮度の列を足す。この章の終わりに開発環境で画面を確かめ、見つけた2件を直した。

自動実装モード: on([introduction](./Phase-116-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/baselines/api/types.ts`](../samples/frontend/src/features/baselines/api/types.ts) | 更新 | 束の応答の `fresh` |
| [`features/baselines/baselineOps.ts`](../samples/frontend/src/features/baselines/baselineOps.ts) | 更新 | `baselineCreateHref`・`freshnessLabel`・`needsRebuild` |
| [`features/baselines/components/BaselineFreshnessNotice.tsx`](../samples/frontend/src/features/baselines/components/BaselineFreshnessNotice.tsx) | 新規 | 束が古いときの知らせ(共通) |
| [`features/baselines/baselines-store.ts`](../samples/frontend/src/features/baselines/baselines-store.ts) | 更新 | 開いた束の鮮度 `freshness` |
| [`features/baselines/components/BaselineList.tsx`](../samples/frontend/src/features/baselines/components/BaselineList.tsx) | 更新 | 鮮度の列 |
| [`features/baselines/components/BaselineDetailContent.tsx`](../samples/frontend/src/features/baselines/components/BaselineDetailContent.tsx) | 更新 | 知らせ・判定できない束 |
| [`features/baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx) | 更新 | `initialCreate`(作成のフォームを開いて始める) |
| [`app/projects/[id]/baselines/page.tsx`](../samples/frontend/src/app/projects/[id]/baselines/page.tsx) | 更新 | `?create=1` |
| [`features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `baseline_freshness`(CR・説明書・作った共有リンク)・`ScaleState`・`ScaleCountRead.state` |
| [`features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `scaleCell(count, state)` |
| [`features/change-requests/components/ScaleTable.tsx`](../samples/frontend/src/features/change-requests/components/ScaleTable.tsx) | 更新 | 基準の束の行・「(古い)」 |
| [`features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 合意の前の知らせ |
| [`features/change-requests/components/ShareLinkPanel.tsx`](../samples/frontend/src/features/change-requests/components/ShareLinkPanel.tsx) | 更新 | 作ったリンクの知らせ |
| [`features/materials/components/ExtractionPanel.tsx`](../samples/frontend/src/features/materials/components/ExtractionPanel.tsx) | 更新 | 取り出しの前の知らせ・取り出したときに古かった(画面確認の後の調整) |
| [`features/materials/components/DifferenceTable.tsx`](../samples/frontend/src/features/materials/components/DifferenceTable.tsx) | 更新 | CR にできる違いが無ければ操作を出さない(画面確認の後の調整) |
| [`features/baselines/test-utils/resetBaselinesStore.ts`](../samples/frontend/src/features/baselines/test-utils/resetBaselinesStore.ts)・[`change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | 新しい項目 |
| [`features/baselines/components/__tests__/BaselineFreshnessNotice.test.tsx`](../samples/frontend/src/features/baselines/components/__tests__/BaselineFreshnessNotice.test.tsx) | 新規 | 出さない・作り直し・最新の束へ |
| `baselineOps`・`baselines-store`・`BaselineDetailContent`・`BaselinesPageContent`・ページ・`changeRequestOps`・`ScaleTable`・`ChangeRequestDetailContent`・`ShareLinkPanel`・`ExtractionPanel`・`DifferenceTable` のテスト(各 `__tests__`) | 更新 | 各節のとおり |

## 1. 共通の知らせ(着手時の決定4)

```tsx
// src/features/baselines/components/BaselineFreshnessNotice.tsx(抜粋)
export function BaselineFreshnessNotice({ projectId, freshness, lead }: {
  projectId: string;
  freshness: BaselineFreshnessRead | null | undefined;   // 新しい・無いときは何も出さない
  lead?: string;                                         // 画面ごとの1文目(何をこの束から求めたか)
})
```

- 見出しは「合意済みの版 B-n は、今の合意と食い違っているかもしれません」。理由は3つ(後の束・束の後に反映した CR と書き換えた要素・束を作った時点で承認のままでなかった段階)。
- **案内**: 束の後の CR や古い段階があれば(`needsRebuild`)「段階を最新にしてから、合意済みの版を作り直してください」+「合意済みの版を作り直す →」(`?create=1` で作成のフォームを開いた形)、古い段階があれば「詳細設計で段階を見る →」も。後の束があるだけなら作り直さず「最新の B-m を見る →」。
- 部品は束の機能(`features/baselines`)に置き、資料・CR から使う(判定が束のものなので)。

| 置き場 | lead | いつ |
|---|---|---|
| 資料のページ(`ExtractionPanel`) | 違いは最新の版と比べる。古い版だと束の後の CR の所が違いとして出る・見落とす | 最新の束が古ければ(取り出しの前も後も) |
| CR の詳細(見出しの下) | 対象の文・説明書・規模は基準の版から求めた | 合意の前だけ(判断の後は判断の時点の予測で組むため。Phase 115 の注記と同じ) |
| 共有リンクの作成の後 | クライアントに見せる説明書の規模はこの版から数えた | 作った応答が古ければ |
| 束の中身 | この版を基準に CR を作ると、この版の設計から求める | 古ければ。合意の記録を始める前の束は「判定できない」を出す |

## 2. 規模の表(着手時の決定6)

- `scaleCell(count, state)`: `stale` は「3件(古い)」。色も「数えられない」(橙)と分ける。
- 表の上に「合意済みの版 B-n の設計から数えました。」、古ければ「B-n は古い版なので、今の設計と違うことがあります。」(説明書の md の行(Phase 115)と同じ趣旨)。理由の行は今の注記の行のまま(`baseline_changed` は「…今の設計と違うことがある(B-n の後に CR-m)」)。

## 3. 束の一覧と中身(着手時の決定7)

- 一覧に「鮮度」の列(新しい / 古い)。古い理由は中身のページの知らせで見る。
- 中身のページはストアが `GET .../freshness` を読み、知らせを出す。

## 4. 画面確認の後の調整

開発環境で、E2E の捨てのプロジェクト「予約の CR」(B-2 は CR-2 の反映の後で古い)に資料を1件足し、実 LLM で違いを取り出し(gemini-3.5-flash-lite、1回)、追加2件から CR-4 の下書きを作った。見つけた2件を直した。

1. 取り出しの回の「取り出したとき、B-2 は古い版でした。」と、今の最新の束の知らせが同じことを2回言っていた → 今の最新の束が新しいときだけ出す。
2. すべての違いを CR にした・確かめる点だけが残ったあとも「0 件を選んでいます」と作るボタンが出ていた → CR にできる違いが無ければ出さない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `BaselineFreshnessNotice.test.tsx` | `BaselineFreshnessNotice` | Testing Library(描画) | スタブ不要 ── 鮮度を受けて描くだけで、ストアも API も呼ばないため |
| `baselineOps.test.ts`・`changeRequestOps.test.ts` | 足した純粋関数 | vitest のテスト関数 | スタブ不要 ── 純粋で外部依存を呼ばないため |
| `baselines-store.test.ts` | `fetchDetail` が鮮度も読む | ストアの関数を直接呼ぶ | fetch(`stubFetch`) |
| `ScaleTable.test.tsx` | 基準の束の行・「(古い)」 | Testing Library | スタブ不要 ── 説明書を受けて描くだけ |
| `ChangeRequestDetailContent`・`ShareLinkPanel`・`BaselineDetailContent`・`BaselinesPageContent`・`ExtractionPanel`・`DifferenceTable` のテスト | 各画面の知らせの出し分け | Testing Library | ストアの関数(vi.fn)・中の部品(既存の vi.mock)── 出す / 出さない の配線だけを見るため |
| `baselines/__tests__/page.test.tsx` | `?create=1` を `initialCreate` に渡す | ページの関数 | 中身の部品(vi.mock) |
