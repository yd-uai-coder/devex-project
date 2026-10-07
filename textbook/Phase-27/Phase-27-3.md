# Phase-27-3: SCR-008 の段階8 ── 単位の一覧と未定義の一覧(FE)

## この章の目的

SCR-008 のステッパーに段階8(実装手順書)を足し、作業領域に「単位の一覧(依存順)」と「未定義・要決定(実装可能性チェック)」を出す。未定義は重要度で絞り込め、各行の「段階Nで直す」で対象の段階へ移る。手順書の生成・単位の詳細は Phase 28。

自動実装モード: on([introduction](./Phase-27-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `FindingLevel`、`StageIssue` の `level?`・`fix_stage?`・`unit?`、段階8の型(`UnitFileKind`・`UnitFile`・`TestPoint`・`AiFinding`・`UnitProcedure`・`ProcedureDocModel`)・`FINDING_LEVELS` |
| [`src/features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | コメント(段階1〜8) |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `STAGE_TITLES[8]`、`FINDING_LEVEL_LABELS`・`FINDING_SOURCE_LABELS` |
| [`src/features/detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `firstPendingStage` の既定を段階8に |
| [`src/features/detailed-design/procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 新規 | `toProcedureDoc`・`procedureUnits`・`collectFindings`・`sortFindings`・`countByLevel`・`filterFindings`・`findingsOfUnit`(純粋) |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 新規 | 段階8のパネル(単位の一覧・未定義の一覧・手順書そのもののエラー) |
| [`src/features/detailed-design/components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | `STAGE_PANELS[8]` |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | コメント(段階1〜8) |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | コメント(段階1〜8) |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeProcedureDoc()`、`makeStages` を段階1〜8に |
| [`src/features/detailed-design/__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 新規 | 純粋関数 |
| [`src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 新規 | 表示・絞り込み・「段階Nで直す」・作業領域への登録 |
| [`src/features/detailed-design/__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 段階1〜8(全部承認済みなら段階8を開く) |
| [`src/features/detailed-design/components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 更新 | ボタンが8つ |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 「次の段階が無い」のは段階8 |

`DesignDocumentBar`(詳細設計書・実装計画の zip)は段階1〜7のまま。段階8の出力は Phase 30。

## 要点の抜粋

```ts
// src/features/detailed-design/procedureDocOps.ts
export type ProcedureUnit = {
  id: string; milestone: string; kind: UnitKind; title: string;
  functionIds: string[]; dependsOn: string[];
  hasProcedure: boolean;   // ID とタスク名の合う手順書があるか
};
export function procedureUnits(plan: PlanModel, doc: ProcedureDocModel): ProcedureUnit[];
//   段階7の並び順(planOps.taskId を再利用)。依存は前の単位だけなので、これが依存順

export type Finding = {
  level: FindingLevel; source: "check" | "ai"; unit: string | null;
  target: string; message: string; fixStage: number;
};
export function collectFindings(issues: StageIssue[], doc: ProcedureDocModel): Finding[];
//   level のある検証の指摘(設計の不足)+ 手順書の AI の指摘を、重要度の順に
//   level の無い指摘(手順書そのもののエラー)は含めない
```

```tsx
// src/features/detailed-design/components/ProcedureDocPanel.tsx
export function ProcedureDocPanel({ stage }: { stage: DesignStageRead }) {
  const planModel = useDetailedDesignStore((s) => s.stages.find((item) => item.stage === 7)?.model ?? null);
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  // 単位の一覧: 単位・種別・タスク・処理・依存・手順書(生成済/未生成)・未定義(重要度ごとの件数)
  // 未定義の一覧: すべて/最重要/中程度/軽微 で絞り込み、行の「段階Nで直す」= jumpTo(fixStage, target)
  // 手順書そのもののエラー: StageIssueList(level の無い指摘だけ)
}
```

依存の向き: `ProcedureDocPanel → procedureDocOps → planOps・api/types`、`ProcedureDocPanel → labels・StageIssueList・tableStyles・detailed-design-store`。パネルは編集を持たないので、`onDirtyChange` は受け取らない(作業領域の「保存してから承認」は出ない)。

## 設計判断

### 未定義の一覧と、検証の結果の一覧を分ける

段階8の指摘は2種類ある。設計の不足(重要度と直す先の段階を持つ警告)は「未定義・要決定」の表に出し、手順書そのもののエラー(`UNIT_MISMATCH` など。重要度を持たない)は、他の段階と同じ「検証の結果」の一覧に出す。前者は設計の側で直すもの、後者は手順書を作り直すもので、直し方が違うため。AI の指摘(model の `findings`)は、検証の指摘と同じ形(`Finding`)にそろえて同じ表に出す(出どころの列で見分ける)。

### 「段階Nで直す」の移動先

既存のストアの `jumpTo(stage, target)` を使う(05↔06 のバッジと同じ)。移った先で行を強調するのは、すでに `focus` を読む段階5だけ(手順ID `F-01#2` ならその行、処理ID `F-01` ならその処理のタブを開く)。段階3・4は段階を開くまでで、行の強調は申し送り([introduction](./Phase-27-introduction.md)「未消化の申し送り」)。段階8のパネルは編集を持たないので、移る前の「保存していない編集は失われます」の確認は要らない。

### 段階8の承認

承認ボタンは作業領域の共通のもので、`canApprove`(行がある・内容がある・エラーが無い)で決まる。この Phase では手順書を作れない(生成は Phase 28)ので、段階8は承認できない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `procedureDocOps` の純粋関数・`STAGE_TITLES[8]`・ラベル | vitest(`procedureDocOps.test.ts`) | スタブ不要 ── 対象は引数の model と指摘だけから決まり、ストアや API を呼ばないため | 第一テスト: ラベルと段階名。読み込みの既定値、単位の並びと手順書の有無(タスク名が変わると未生成)、指摘のまとめ方と並び、件数・絞り込み |
| `ProcedureDocPanel`・`StageWorkArea` の段階8 | vitest + RTL(`ProcedureDocPanel.test.tsx`) | ストアの `jumpTo`(`vi.fn`)── 移動は画面全体の状態を変えるため、呼ばれた引数だけを見る | 単位の一覧の行、絞り込み、「段階5で直す」が `jumpTo(5, "F-01")`、手順書が無くても指摘が出る、手順書そのもののエラーは検証の結果に出る |
| `firstPendingStage`・`StageStepper`・`DetailedDesignPageContent` | vitest(既存のテストの更新) | 既存どおり | 段階が8つになった前提に直した |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design --maxWorkers=4
npx tsc --noEmit && npx eslint src/features/detailed-design
```
