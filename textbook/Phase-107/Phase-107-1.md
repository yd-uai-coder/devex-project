# Phase-107-1: 変更の規模の表示

## この章の目的

Phase 101・102 の規模の API(説明書の応答の `scale`・`option_scales`、比較の応答の `scale`)を、CR の詳細に出す。合意の前は「内容」タブに規模の表を置き(着手時の相談 (2))、案のある CR は種類 × 案の表にして、案を手間で比べられるようにする。数えられない種類は0件と書かず「数えられない」と出し、理由と注記を表の下にまとめる。反映の後は「影響」タブの比較に、予測と実際の数を並べる。

自動実装モード: on([introduction](./Phase-107-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ScaleKind`・`ScaleRemarkRead`・`ScaleCountRead`・`OptionScaleRead`・`ScaleComparisonRead`。説明書に `scale`・`option_scales`、比較に `scale` |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `scaleColumns`・`scaleCell`・`scaleRemarkLines`・`scaleComparisonBasis` |
| [`src/features/change-requests/components/ScaleTable.tsx`](../samples/frontend/src/features/change-requests/components/ScaleTable.tsx) | 新規 | 規模の表と、理由・注記の行 |
| [`src/features/change-requests/components/ContentTab.tsx`](../samples/frontend/src/features/change-requests/components/ContentTab.tsx) | 更新 | 説明書のビューを読み、「変更の規模」の節を出す |
| [`src/features/change-requests/components/ImpactTab.tsx`](../samples/frontend/src/features/change-requests/components/ImpactTab.tsx) | 更新 | 比較に「規模の予測と実際」の表 |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeScale`。説明書・比較の既定に規模 |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 規模の純粋関数 |
| [`src/features/change-requests/components/__tests__/ScaleTable.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ScaleTable.test.tsx) | 新規 | 1列と内訳・案ごとの列 |
| [`src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 更新 | 説明書のビューを読み、規模を出す |
| [`src/features/change-requests/components/__tests__/ImpactTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx) | 更新 | 規模の予測と実際 |

## 1. 置き場と見た目

```
内容  影響  検証  説明書  共有  たどる記録
 ├ 内容・背景・対象の要件(今のまま)
 ├ 選択肢(案)            ← 107-2
 ├ 変更の規模
 │   種類     | 案1 5件まで(おすすめ) | 案2 上限なし
 │   作業単位 | 1件                   | 3件
 │   API      | 数えられない          | 数えられない
 │   ・案1 5件まで ── APIは数えられない: 要る文書が束に無い(外部設計書)
 └ 合意の記録・重なり…(今のまま)
```

- 規模の数は説明書の3節(案のある CR は4節)と同じものなので、説明書の応答を読む。影響の応答には規模が無い。内容タブと説明書タブはストアの `views.explanation` を共有するので、どちらを先に開いても読むのは1回である。
- 列は `scaleColumns` が決める。合意の前で案がある(`option_scales` が空でない)ときは案ごと、それ以外は CR の1列(「この変更」)。1列のときだけ「内訳」(数えたものの表示名)を出す。案ごとの列で内訳まで出すと、表が横に長くなりすぎるため(内訳は説明書の md にある)。
- 表の下に「合意済みの版の設計から決まった規則で数えた、手を入れる量の目安です(工数や費用ではありません)」と添える(説明書の節の頭の1文と同じ趣旨)。

## 2. 規模の純粋関数

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export type ScaleColumn = { key: string; title: string; recommended: boolean; scale: ScaleCountRead[] };
export function scaleColumns(explanation: ChangeRequestExplanationRead): ScaleColumn[]
export function scaleCell(count: number | null): string          // "n件" / "数えられない"
export function scaleRemarkLines(columns: ScaleColumn[]): ScaleRemarkLine[]
export function scaleComparisonBasis(row: ScaleComparisonRead): string
```

- `scaleRemarkLines`: 数えられない理由(`uncountable`)と注記(`notes`)を、同じ列・同じ理由ごとに1行にまとめ、種類を「作業単位・ファイル」のように並べる(説明書の3節の書き方と同じ)。列が複数なら行の頭に「案1 名前 ── 」を付ける。
- `scaleComparisonBasis`: 反映の後の実際の数の数え方。`marks` は「反映で付いた印から、今の設計で数えた数」、`document_checks`(画面・API)は「予測のうち、文書の側の確認の一覧で確かめた数」(Phase 101 の決定)。

## 3. 部品

- `ScaleTable`(新規): 説明書の応答を受け取って描くだけ(ストアを読まない)。数えられないセルは橙の文字。
- `ContentTab`(更新): 開いたときに `fetchView(..., "explanation")`。読み込み中・失敗(`viewErrors.explanation`)・表を出し分ける。
- `ImpactTab`(更新): 比較の応答の `scale` が空でなければ、比較の3つの群の上に「規模の予測と実際」の表(種類・予測・実際・実際の数え方)を置く。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts`「変更の規模」 | `scaleColumns`・`scaleCell`・`scaleRemarkLines`・`scaleComparisonBasis` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まり、外部依存を呼ばないため |
| `ScaleTable.test.tsx`(新規) | `ScaleTable` | Testing Library(描画) | スタブ不要 ── 説明書の応答(`makeExplanation`・`makeScale`)を受け取って描くだけで、ストアも API も呼ばないため |
| `ContentTab.test.tsx` | `ContentTab`(+ `ScaleTable`) | Testing Library | ストアの関数(`vi.fn`)── 説明書のビューの読み込みと、読めたときの表だけを見るため |
| `ImpactTab.test.tsx` | `ImpactTab` | Testing Library | ストアの関数(`vi.fn`)── 比較の応答の規模の表だけを見るため |

- 統合スモーク: 内容タブを開くと説明書のビューを読み、読めると規模の表を出す。
- 0件は「0件」、数えられないは「数えられない」(0件と書かない)。
- 同じ列の同じ理由は種類をまとめ、列が複数なら列の名前を頭に付ける。
- 案ごとの列は、おすすめの列に「(おすすめ)」を付け、内訳の列を出さない。
- 反映の後の比較で、予測と実際の数を並べ、数えられない種類は両方「数えられない」。
