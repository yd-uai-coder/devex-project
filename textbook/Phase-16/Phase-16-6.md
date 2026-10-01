# Phase-16-6: 段階1の作業領域(FE)

## この章の目的

SCR-008 の段階1の「準備中」を、機能一覧の作業領域に置き換える。

- 下書きの生成(内容があるときは作り直す前に確認する)と、生成中のポーリング
- 機能グループの追加・改名・削除と、機能一覧の表の編集(行の追加・削除を含む)
- 検証の結果(エラー・警告)の表示と、保存
- 保存していない編集や検証のエラーがあるうちは、承認させない

学習モード([introduction](./Phase-16-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`functionListOps.ts`](../samples/frontend/src/features/detailed-design/functionListOps.ts) | 新規 | **コア** | `toFunctionList`・`addRow`・`removeRow`・`updateRow`・`addGroup`・`renameGroup`・`removeGroup`・`isGroupUsed`・関連画面の変換(純粋) |
| [`detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | **コア** | `save`・`generate`、`saving`・`requestingGeneration`、エラーコードの文言 |
| [`hooks/useStageGenerationPolling.ts`](../samples/frontend/src/features/detailed-design/hooks/useStageGenerationPolling.ts) | 新規 | 定型 | 生成中は段階の一覧を取り直す(打ち切りあり) |
| [`labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | 定型 | `hasErrors`、`canApprove` に生成中・内容が空・検証のエラー、状態「再生成済(未承認)」 |
| [`components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | 定型 | 「再生成済(未承認)」の色 |
| [`components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx) | 新規 | **コア** | 段階1の作業領域の中身 |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | **コア** | 段階1で `FunctionListPanel` を出す。保存していない編集があれば承認を止める |
| [`components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 定型 | `projectId` を作業領域へ渡す |
| ── ここからテスト ── | | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeFunctionList()` |
| [`__tests__/functionListOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/functionListOps.test.ts) | 新規 | **コア** | 採番と番号の非再利用、改名の付け替え、重複の拒否 |
| [`__tests__/labels.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/labels.test.ts) | 更新 | 定型 | 承認できない3条件(生成中・内容が空・検証のエラー) |
| [`__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 定型 | `save`・`generate`、生成中の 409 の文言 |
| [`hooks/__tests__/useStageGenerationPolling.test.ts`](../samples/frontend/src/features/detailed-design/hooks/__tests__/useStageGenerationPolling.test.ts) | 新規 | 定型 | 間隔と打ち切り |
| [`components/__tests__/FunctionListPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/FunctionListPanel.test.tsx) | 新規 | **コア** | 生成と確認、編集と保存、改名、行の追加、失敗の理由と指摘、生成中の無効化 |
| [`components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 更新 | 定型 | 「再生成済(未承認)」の表示 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | `projectId` と、承認できる段階に内容を持たせる |
| [`components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 定型 | 同上 |

## 要点の抜粋

```ts
// functionListOps.ts
export function addRow(model: FunctionListModel): FunctionListModel {
  const row = { id: formatFunctionId(model.next_number), group: model.groups[0] ?? "", ... };
  return { ...model, functions: [...model.functions, row], next_number: model.next_number + 1 };
}
// removeRow は next_number を戻さない(バックエンドの merge_draft と同じ規則)

export function renameGroup(model, from, to) {
  if (!to.trim() || to.trim() === from || model.groups.includes(to.trim())) return model;  // 混ざるのを防ぐ
  // groups と、そのグループの行の group をまとめて付け替える
}
```

```tsx
// components/StageWorkArea.tsx
const [dirty, setDirty] = useState(false);
{hasPanel ? (
  <FunctionListPanel
    key={`${stage.version}-${stage.generation_status}`}   // 保存・生成のたびに作り直す
    projectId={projectId} stage={stage} onDirtyChange={setDirty} />
) : (/* 準備中 */)}
<StyledButton disabled={!canApprove(stage) || approving || (hasPanel && dirty)}>
```

```tsx
// components/FunctionListPanel.tsx
const saved = toFunctionList(stage.model);
const [draft, setDraft] = useState<FunctionListModel>(saved);     // 編集中の内容は手元だけに持つ
const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
const { timedOut } = useStageGenerationPolling(projectId, stage.generation_status === "generating");
```

依存の向きは「`StageWorkArea` → `FunctionListPanel` → ストア・`functionListOps`・ポーリング」。`functionListOps` は型だけに依存する純粋関数である。

## 設計判断

### 編集中の内容はストアに置かず、作業領域の中に持つ

ストアの `stages` はサーバーの内容(保存済み)だけを持つ。編集中の内容まで入れると、ポーリングや保存後の取り直しで、どちらが新しいかを毎回判断することになる。

作業領域の中に持ち、`key`(版と生成の状態)が変わったら作り直す。保存・生成で版が変わると、編集中の内容はサーバーの内容に戻る。版の比較や同期の処理を書かずに済む。

### 承認を止める条件

| 条件 | どこで判断するか | 理由 |
|---|---|---|
| 生成中・内容が空・検証のエラー | `canApprove`(バックエンドも 409) | 16-3 の承認の条件と同じ |
| 保存していない編集がある | `StageWorkArea`(画面だけ) | 承認されるのは保存済みの版。画面に見えている内容と、承認される内容が違ってしまう |

検証の結果は「保存した内容」に対するものだと表示に書いた。検証はバックエンドで行い、画面で同じ規則を書き直さない(規則が2か所に分かれると食い違う)。

### 作り直す前に確認する

内容がある段階で「下書きを作り直す」を押すと、確認ダイアログを出す。文面は状況で変える。

- 処理IDと確定した機能グループは、トリガーが同じ行に引き継ぐこと(16-2)
- 保存していない編集があれば、それが失われること
- 承認済み・古い段階なら、承認がやり直しになること

内容が無い段階(初めての生成)は、確認を出さずに始める。失うものが無いからである。

### 表は素の table と入力欄で書く

列が8つあり横に長いので、Tamagui の部品ではなく、素の `table`・`input`・`select` で詰めて並べた。Phase 14 のデモ(`demo/DetailedDesignDemoPageContent.tsx`)と同じ書き方である。入力欄にはそれぞれ `aria-label`(`F-01 の名称` など)を付け、テストからも取れるようにした。

素の要素は Tamagui のテーマを受け取らないので、色はテーマの CSS 変数(`var(--background)`・`var(--color)`)で指定する。当初は背景を `transparent` にしていたため、セレクトの選択肢(ブラウザが描くポップアップ)が既定の白になり、ダークモードでは文字と同じ色になって読めなかった(画面の確認で見つかった)。`<option>` にも同じ色を付けて直した。

### 状態「再生成済(未承認)」

作り直した段階は、ステッパーと作業領域で「再生成済(未承認)」と出す(16-4 の `regenerated`)。承認できる状態の1つである。「古い」の文面は、下書きも生成時の入力の版を記録するようになったので、「この段階を作った・承認した後に、入力が変わりました」に直した。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `functionListOps` | vitest | スタブ不要。純粋関数のため | 採番と番号の非再利用、改名の付け替え、空・重複の拒否、処理が残るグループの削除の拒否 |
| `canApprove`・`hasErrors` | vitest | スタブ不要。同上 | 承認できない3条件と、警告だけなら承認できること |
| `useDetailedDesignStore`(`save`・`generate`) | vitest | `stubFetch`(`fetch` の代わり) | 見ていた版で保存、受け付け後の取り直し、生成中の 409 の文言 |
| `useStageGenerationPolling` | vitest(`renderHook`・偽のタイマー) | ストアの `fetchStages` を差し替える | 間隔ごとの取り直しと打ち切り |
| `FunctionListPanel` | vitest + Testing Library | ストアの `save`・`generate` を差し替える | 第一テストに当たる「内容が無ければ確認なしで生成」から、確認・編集・保存・改名・行の追加・表示まで |
| `StageWorkArea`・`DetailedDesignPageContent` | vitest + Testing Library | ストアの操作を差し替える | 既存のテストに、段階1の内容(`makeFunctionList()`)を足した |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design "src/app/(pages)/(protected)/projects/[id]/detailed-design"
# 61 passed
```
