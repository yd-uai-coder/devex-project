# Phase-23-6: 段階7の作業領域と、ダウンロードのバー(FE)

## この章の目的

SCR-008 の段階7に、横断事項と実装計画を作る画面(`PlanPanel`)を置く。段階4の `StructurePanel` と同じ形にする。

- 下書きの生成(内容があれば、確認してから作り直す)
- 表の編集: 07 横断事項、マイルストーンとタスク、開発環境、リスク
- 上下の保存バーと、検証の結果

あわせて、次の3つを改める。

- 段階7の名前を「横断事項と実装計画」にする。
- ダウンロードのバーの件数を「段階1〜7」に広げる。
- 段階4の「,」区切りの入力欄 `ListInput` を、共有の部品に切り出す(#17)。

納期モード([introduction](./Phase-23-introduction.md) 参照)。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`features/detailed-design/components/ListInput.tsx`](../samples/frontend/src/features/detailed-design/components/ListInput.tsx) | 新規 | **コア** | 「,」区切りの入力欄(入力中の文字列を手元に持つ)。`ModuleListTable` から移した |
| [`features/detailed-design/components/ModuleListTable.tsx`](../samples/frontend/src/features/detailed-design/components/ModuleListTable.tsx) | 更新 | 定型 | 中の `ListInput` を削除し、共有のものを import する |
| [`features/detailed-design/components/PlanTables.tsx`](../samples/frontend/src/features/detailed-design/components/PlanTables.tsx) | 新規 | 定型 | `CrossCuttingTable`(欠けた既定の項目を足すボタン)・`MilestoneList`(M-ID・上下の移動・中のタスクの表)・`RiskTable` |
| [`features/detailed-design/components/PlanPanel.tsx`](../samples/frontend/src/features/detailed-design/components/PlanPanel.tsx) | 新規 | 定型 | 段階7の作業領域(生成・作り直しの確認・表・開発環境・保存・検証の結果) |
| [`features/detailed-design/components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | 定型 | `STAGE_PANELS[7] = PlanPanel` |
| [`features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | 定型 | `STAGE_TITLES[7]` を「横断事項と実装計画」に |
| [`features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 更新 | 定型 | 件数を段階1〜7に、ボタンを「詳細設計書と実装計画をダウンロード(.zip)」に |
| ── ここからテスト ── | | | |
| [`features/detailed-design/components/__tests__/ListInput.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ListInput.test.tsx) | 新規 | 定型 | 区切りの「,」を打っても消えない |
| [`features/detailed-design/components/__tests__/PlanTables.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/PlanTables.test.tsx) | 新規 | 定型 | 表の表示、既定の項目の追加、優先度・区分・タスクの追加、並べ替え、閉じた段階 |
| [`features/detailed-design/components/__tests__/PlanPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/PlanPanel.test.tsx) | 新規 | 定型 | 生成、編集と保存、作り直しの確認、生成中・失敗 |
| [`features/detailed-design/components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 段階7に `PlanPanel` が出る(「準備中」のテストを置き換えた) |
| [`features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 更新 | 定型 | 件数が段階1〜7、ボタンの名前 |
| [`features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 定型 | ボタンの名前と件数、段階7の完了ダイアログの文言 |

## 要点の抜粋

```tsx
// features/detailed-design/components/StageWorkArea.tsx
const STAGE_PANELS = { 1: FunctionListPanel, ..., 6: LogicPanel, 7: PlanPanel };   // 全段階にパネル
```

```tsx
// features/detailed-design/components/PlanPanel.tsx(StructurePanel と同じ形)
const saved = toPlan(stage.model);
const [draft, setDraft] = useState<PlanModel>(saved);
const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
// 生成ボタン: 内容があれば ConfirmDialog → generate(projectId, 7)。保存していない編集がある間は押せない
// 表: <CrossCuttingTable/> <MilestoneList/> 開発環境の textarea <RiskTable/>(どれも onChange={setDraft})
```

```tsx
// features/detailed-design/components/DesignDocumentBar.tsx
const DOCUMENT_STAGES = [1, 2, 3, 4, 5, 6, 7];   // 段階7は07章と実装計画の元
```

## 設計判断(要点のみ)

- **`ListInput` の切り出し(#17)**: 段階7の表は、ファイル・処理ID を「,」区切りで入れる欄を、横断事項・マイルストーン・タスクの3か所で使う。段階4の `ModuleListTable` の中だけの部品だったので、`components/ListInput.tsx` へ移して共有した。今この共通化を必要としているのは `PlanTables`。
- **M-ID は画面でも並び順から**: 上下のボタンで動かすと、番号が振り直される。番号で参照しているものが無いので(23-1)、何も切れない。
- **ファイルの欄の見出し(画面確認後)**: 「作成・変更するファイル(例)」「関わるファイル(例)」とし、説明に「検証はしません」と書く。環境・設定のファイル(`Dockerfile` など)も書けることを、表の説明で知らせる(23-1)。
- **完了ダイアログ**: 段階7の承認後のダイアログは、Phase 18 から「閉じる」だけになっている。名前が変わったので、文言は「段階7-横断事項と実装計画を承認しました。」になる。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run --maxWorkers=4 src/features/detailed-design
# 38 files / 233 passed
npx tsc --noEmit
```
