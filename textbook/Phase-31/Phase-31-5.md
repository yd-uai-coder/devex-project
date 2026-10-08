# Phase-31-5: 画面 ── SCR-005 の入口と段階8だけの SCR-008(FE)

## この章の目的

簡易モードのプロジェクトで、SCR-005(ドキュメントプレビュー)の「実装手順書へ進む →」から、同じ SCR-008 を段階8だけのステッパーで開けるようにする(着手時の決定2)。段階8のパネルは、作業単位を段階8の応答の `plan` から読む(31-4)。簡易モードの指摘の直す先(文書)は、文書の画面へのリンクにする。

自動実装モード: on([introduction](./Phase-31-introduction.md) 参照)。E2E は期待だけを足し、流すのは Phase 32(#36)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `ProjectMode`・`DesignDocument`。`StageIssue.fix_document`・`DesignStageRead.mode`・`DesignStageRead.plan`・`AiFinding.fix_document`・`DesignRefRead.kind` に `dataflow` |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `DESIGN_DOCUMENT_LABELS`(4文書の名前。足りない入力の表示も共有) |
| [`src/features/detailed-design/procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 更新 | `DESIGN_DOCUMENTS`。`toProcedureDoc` が `fix_document` を読む。`Finding.fixDocument`。`FixTarget`・`fixTarget(fixStage, fixDocument)` |
| [`src/features/detailed-design/components/FixTargetButton.tsx`](../samples/frontend/src/features/detailed-design/components/FixTargetButton.tsx) | 新規 | 「段階Nで直す」(段階へ移る)/「〇〇書を直す(再生成)」(SCR-005 へのリンク) |
| [`src/features/detailed-design/components/UnitProcedureEditor.tsx`](../samples/frontend/src/features/detailed-design/components/UnitProcedureEditor.tsx) | 更新 | `mode`。共通の節のバッジの名前、タスク名の不一致の文言、AI の指摘の直す先(簡易モードは文書を選ぶ)と「直す」 |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 作業単位を `stage.plan` から読む。簡易モードの説明文と、単位が読めないときの案内。未定義の「直す」を `FixTargetButton` に |
| [`src/features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 更新 | `availableDownloads(stages)` ── 持っている段階で作れる zip だけを出す(簡易モードは実装手順書だけ) |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 簡易モードは見出しを「実装手順書」に |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 簡易モードに「実装手順書へ進む →」(`/projects/{id}/detailed-design`) |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeStages` が `mode: "detailed"`・`plan: null` を持つ |
| [`src/features/detailed-design/__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 更新 | 直す先の文書の読み取り・集約・`fixTarget` |
| [`src/features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 応答の見本に `mode`・`plan` |
| [`src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 更新 | 単位を段階8の `plan` から読む。簡易モードの単位・文書へのリンク・単位が読めないときの案内 |
| [`src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx) | 更新 | 簡易モードの直す先の選択・リンク・共通の節のバッジ |
| [`src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 更新 | 簡易モードは実装手順書の zip だけ |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 簡易モードの見出しと、詳細設計書の zip を出さないこと |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 簡易モードの「実装手順書へ進む →」 |
| [`e2e/devex-flow.spec.ts`](../samples/frontend/e2e/devex-flow.spec.ts) | 更新 | 簡易モードの一連の流れの最後に、入口から段階8の単位の一覧まで(Phase 32 で流す) |

FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```ts
// src/features/detailed-design/procedureDocOps.ts
export type FixTarget =
  | { kind: "document"; document: DesignDocument }
  | { kind: "stage"; stage: number }
  | null;
export function fixTarget(fixStage: number, fixDocument: DesignDocument | null | undefined): FixTarget
```

```tsx
// src/features/detailed-design/components/FixTargetButton.tsx
export function FixTargetButton({ projectId, target, onStage }) {
  if (target === null) return null;
  if (target.kind === "document")
    return <Link href={`/projects/${projectId}/documents`}>{`${DESIGN_DOCUMENT_LABELS[target.document]}を直す(再生成)`}</Link>;
  return <Button onPress={() => onStage(target.stage)}>{`段階${target.stage}で直す`}</Button>;
}
```

```tsx
// src/features/detailed-design/components/ProcedureDocPanel.tsx
const planModel = stage.plan;              // 以前は段階7の model をストアから読んでいた
const simple = stage.mode === "simple";
const units = procedureUnits(toPlan(planModel), doc);
```

```tsx
// src/features/detailed-design/components/DesignDocumentBar.tsx
export function availableDownloads(stages: DesignStageRead[]): DownloadItem[]  // 元の段階をすべて持つ zip だけ
```

## 設計判断

### SCR-008 をそのまま使う(着手時の決定2)

段階8のパネル・単位の詳細・承認前の確認・AI 向けにコピー・ダウンロードの帯は、すべて SCR-008 の部品である。ステッパーは渡された段階を並べるだけで、ストアの初めの段階(`firstPendingStage`)も段階8を選ぶ。段階8だけの一覧を返すサーバー(31-4)と組み合わせると、画面の分岐は5つで済む。

- 見出し
- 帯の zip
- 単位の出どころ
- 直す先
- 説明文

別の画面や SCR-005 のタブにすると、これらの部品を移すか、重複させることになる。

### 作業単位は段階8の `plan` から読む

詳細設計モードでも、段階8のパネルは段階7の model でなく段階8の応答の `plan` を読む。両モードで同じ読み方にし、単位を決める規則をサーバーの1か所(`ProcedureBasis`)に置く(#17)。

### 直す先が文書なら、文書の画面へのリンクにする

簡易モードの文書は画面で編集できず、直すときは再生成する。「〇〇書を直す(再生成)」は SCR-005 へ移るリンクにした。どの文書を直すかは文言で示す(SCR-005 にタブを選ぶ URL は無いので、タブは移った先で選ぶ)。単位の詳細の AI の指摘の表では、簡易モードは直す先を4文書と「手順書」(直す先が無い)から選ぶ。

### 単位が読めないときは画面で知らせる

旧形式の実装計画書では、単位の一覧が空になる。指摘の一覧に `WBS_MISSING` が出るが、一覧が空だけだと戸惑うので、一覧の下に「実装計画書の WBS から作業単位を読めませんでした。下の指摘を見て、文書を再生成してください」を出す。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `procedureDocOps`(`toProcedureDoc`・`collectFindings`・`fixTarget`) | vitest | スタブ不要 ── 引数の model と指摘だけから決まり、ストアや API を呼ばないため | 直す先の文書を読み(知らない値は null)、検証と AI の両方の指摘に載る。文書は段階より優先し、段階8は null |
| `ProcedureDocPanel` | render と操作 | ストア(`useDetailedDesignStore` の操作)を差し替える | 第一テスト(既存): 単位を段階8の `plan` から並べる。簡易モードは説明文・単位・「実装計画書を直す(再生成)」のリンク(「段階Nで直す」は出ない)。単位が読めなければ案内 |
| `UnitProcedureEditor` | render と操作 | 参照の API(`getUnitContext`)・AI 向けの版の API・クリップボード・`onChange`・`onFix` | 簡易モードは「内部設計書を直す(再生成)」のリンク、直す先の選択で `fix_stage=8` と文書を返す、共通の節のバッジは「内部設計書 3.4」 |
| `DesignDocumentBar`・`availableDownloads` | render | fetch・`saveFile` | 簡易モード(段階8だけ)は実装手順書の zip だけで、承認済みなら押せる |
| `DetailedDesignPageContent` | render | ストア | 簡易モードの見出しは「実装手順書」、詳細設計書の zip は出ない |
| `DocumentsPageContent` | render | ドキュメントのストア・`useGenerationPolling` | 簡易モードは「実装手順書へ進む →」が `/projects/p1/detailed-design` を指す(詳細設計へ進むは出ない) |
| E2E(`devex-flow.spec.ts`) | Playwright | 偽 LLM(`E2E_FAKE_LLM=true`) | 簡易モードの4文書の後、入口から段階8の単位の一覧(`M-01-T01`・`M-01-T02`)まで。Phase 32 で流す |
