# Phase-44-2: 「変更の影響」パネルと段階の状態の印

## この章の目的

詳細設計画面(SCR-008)の作業領域の上に、全段階の変更の影響をまとめた「変更の影響」パネルを置く(着手時の決定2)。変わったもの → 段階ごとの影響の一覧(要素・たどった道・理由・変わった場所・状態)を出し、印を確認済みにし、「表で見る」でその段階の表の行を強調して開く。あわせて、ステッパーと選んだ段階の作業領域に印の件数を出す。[`docs/external_design.md`](../../docs/external_design.md) 2.10節「影響の一覧」「段階の状態と印」の実装。

自動実装モード: on([introduction](./Phase-44-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/detailed-design/` 配下(依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`components/ImpactBadge.tsx`](../samples/frontend/src/features/detailed-design/components/ImpactBadge.tsx) | 新規 | 印(見直し・確認済み・承認すると付く)の小さなバッジ。パネルと各段階の表(44-3)で共有 |
| [`components/ChangeImpactPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ChangeImpactPanel.tsx) | 新規 | 「変更の影響」パネル(折りたたみ・絞り込み・変わったもの・段階ごとの印の表・確認済み・表で見る) |
| [`components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | 状態の横に未確認の印の数(「見直し N」) |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 「変更の影響: 見直し N / 確認済み M」と、承認ボタンの横の案内。閉じた段階の案内(完了後の調整) |
| [`components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | ダウンロードの帯とステッパーの間にパネルを置く(詳細設計モードだけ) |
| ── ここからテスト ── | | |
| [`components/__tests__/ChangeImpactPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ChangeImpactPanel.test.tsx) | 新規 | 出さない条件・変わったもの・印の表・文書のリンク・確認済みの操作・表で見る・たたむ・取得の失敗 |
| [`components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 更新 | 未確認の印の数 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 件数と承認し直しの案内 |
| [`components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | パネルを出す |

## 要点の抜粋

### 1. パネルの構成

```
┌ 変更の影響(未確認 2)────────────────── [たたむ] ┐
│ [全段階] [段階5(未確認 1)] [段階6] [段階8(未確認 1)] □未確認のみ  │
│ 変わったもの: 変わった場所 / 要素(改名先) / 変化 / 前 / 後       │
│ 段階5 主要処理の手順(見直し 1 / 確認済み 0) [この段階の未確認をすべて確認済みにする] │
│   要素 / たどった道 / 理由 / 変わった場所 / 状態 / [確認済みにする][表で見る] │
│ 再生成の候補(44-4)                                            │
└────────────────────────────────────────┘
```

```tsx
// src/features/detailed-design/components/ChangeImpactPanel.tsx
export function ChangeImpactPanel({ projectId }: { projectId: string })
```

- **絞り込み**(Phase 44 の完了後の調整。全段階を並べると縦に長くなったため): 初めは、ステッパーで選んでいる段階の印・変わったもの・再生成の候補だけを出し、段階を選び直すと追従する。段階のボタン(印のある段階ごとに未確認の数)は `selectStage` を呼ぶので、作業領域も同じ段階へ移る。「全段階」で全部を並べ、「未確認のみ」で確認済みと「承認すると付く」印を隠す。見出しの「未確認 N」は全段階の合計のまま。選んでいる段階に印が無ければ「この段階に届いた印はありません。」と出す。段階と未確認の数は `stageMarkSummary`、出す印は `visibleMarks`(`impactOps.ts`)。
- 印も変わったものも無く、取得の失敗も無ければ何も出さない。未確認の印があれば開いて出す(`useState(open > 0)`)。
- 変わったものは、段階ごとに記録されている同じ変更(出どころ・キー・変化・pending が同じもの)を1行にまとめる。文書(置き場 0)の変更には文書の画面へのリンクを添える。
- 段階ごとの表は `marksByKey`(44-1)で引く。同じ要素に記録した印と pending の印があれば、記録した印を出す。
- 操作: 未確認の印は「確認済みにする」、確認済みは「未確認に戻す」、pending の印は操作なし(記録していないので確認済みにできない)。「表で見る」は `showInTable(段階, キー)`。

### 2. 印のバッジ

```tsx
// src/features/detailed-design/components/ImpactBadge.tsx
export function ImpactBadge({ mark }: { mark: ImpactMarkRead | undefined })
```

印が無ければ何も出さない。`title` に理由を入れ、表の行でも理由を確かめられるようにする。`aria-label` は「変更の影響: 見直し」の形(テストと読み上げで使う)。

### 3. 段階の状態の印

ステッパーは `impact_open`(段階の一覧の件数)だけで「見直し N」を出す(影響の応答を待たない)。作業領域は件数の行と、未確認があるときの承認ボタンの横の案内(「他の段階・文書から届いた見直しの印は、確認済みにしてから承認し直してください」)。閉じた段階(上流が「古い」・未承認)に保存した内容があれば「消えていません」と、今承認し直せばよい段階(`labels.ts` の `firstStageToApprove`)・その段階へ移るボタンを出す(Phase 44 の完了後の調整。上流の「古い」で下流が連鎖して閉じ、内容が消えたように見えたため)。承認を止めるのはサーバーの 409 で、画面は案内だけにした(自分の段階の中の依存で付いた印は止めないので、画面で同じ判定を持つと二重になる)。

## 設計判断

### 置き場は作業領域の上・全幅

印は段階をまたいで届き、確認は段階ごとに行う。全段階を一度に見渡せる置き場として、作業領域の上の全幅にした(着手時の決定2。[41-2](../Phase-41/Phase-41-2.md) 決定8 のデモで決めた「作業領域のパネル + 各表の印」の置き場)。印が無い間は何も出さないので、ふだんの画面は変わらない。

### 文書の要素には印を出さない

バックエンドは文書の要素(置き場 0)に印を記録しない(43-3。変えた人が見ているため)。画面も文書の変更を「変わったもの」に出すだけにした(41-5 の Phase 44 の未確定事項「文書の要素の印をどこに出すか」の結論)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ChangeImpactPanel`(`ImpactBadge` を含む) | vitest + Testing Library(描画と操作) | ストアの `reviewMarks`・`showInTable`・`selectStage`(vi.fn。API と段階の移動の代わり)。影響は `makeImpact`、選んでいる段階は `selectedStage` をストアに置く | 印が無ければ出さない、未確認があれば開いて全段階では変わったもの(重複なし・pending)と段階ごとの印を出す(スモーク)、初めは選んでいる段階だけ・段階が変わると追従・印の無い段階の文、段階のボタンで `selectStage`、未確認のみ、文書の変更のリンク、確認済み・未確認に戻す・段階まとめての確認済みの引数、pending は操作なし、表で見るの引数、たたむ・取得の失敗 |
| `StageStepper`・`StageWorkArea`・`DetailedDesignPageContent` | vitest + Testing Library | スタブ不要(`StageStepper`・`StageWorkArea` は渡した段階を描くだけ)/ ページはストアの `fetchStages` など(既存のテストと同じ) | 見直しの数、件数と案内、パネルを出す |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/components/__tests__/{ChangeImpactPanel,StageStepper,StageWorkArea,DetailedDesignPageContent}.test.tsx
```
