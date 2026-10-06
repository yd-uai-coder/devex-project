# Phase-17-6: 段階2の作業領域(グループの選択・生成・処理概要表)(FE)

## この章の目的

SCR-008 の段階2の作業領域を作る。DFD を描く機能グループの選択、AI の下書きの生成(と作り直しの確認・ポーリング)、処理概要表の編集、検証の結果、保存を持つ。DFD のタブ(17-7)とデータ辞書の表(17-8)は、この章の後で同じパネルに足す。

あわせて、段階1のパネルと共有する部品(表の見た目・検証の結果の一覧)を切り出し、作業領域を「段階番号 → パネル」の対応にする。

自動実装モード: on([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/tableStyles.ts`](../samples/frontend/src/features/detailed-design/components/tableStyles.ts) | 新規 | 定型 | 表の見た目(`CELL`・`HEAD`・`TABLE`・`INPUT`・`OPTION`・`MONO`)。`FunctionListPanel` から切り出した |
| [`components/StageIssueList.tsx`](../samples/frontend/src/features/detailed-design/components/StageIssueList.tsx) | 新規 | 定型 | 検証の結果(エラー・警告)の一覧。`FunctionListPanel` から切り出した |
| [`components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx) | 更新 | 定型 | 上の2つを使うように置き換え(挙動は変えない) |
| [`dataFlowOps.ts`](../samples/frontend/src/features/detailed-design/dataFlowOps.ts) | 新規 | **コア** | `toDataFlow`・`hasDraft`・`toggleDfdGroup`・`summaryOf`・`updateSummary`・`countGroupFunctions`(純粋) |
| [`components/DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx) | 新規 | **コア** | 段階2の作業領域(グループの選択・生成・処理概要表・保存・検証の結果) |
| [`components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 更新 | **コア** | `STAGE_PANELS`(段階番号 → パネル)に段階2を登録 |
| ── ここからテスト ── | | | |
| [`__tests__/dataFlowOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/dataFlowOps.test.ts) | 新規 | 定型 | 正規化、内容の判定、上限、行の追加 |
| [`components/__tests__/StageIssueList.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageIssueList.test.tsx) | 新規 | 定型 | エラーと警告の表示、指摘が無いとき・表の見た目 |
| [`components/__tests__/DataFlowPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx) | 新規 | **コア** | 選択 → 保存 → 生成の順、作り直しの確認、処理概要表の編集、失敗と検証の表示 |
| [`components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 更新 | 定型 | 開いた段階2にパネルを出す |

既存の [`components/__tests__/FunctionListPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/FunctionListPanel.test.tsx)(変更なし)が、切り出しの写経ミスの番人になる(#12-4)。

## 要点の抜粋

```ts
// dataFlowOps.ts
export function hasDraft(model: DataFlowModel): boolean {
  return model.summaries.length > 0;               // バックエンドの _has_draft と同じ規則
}
export function toggleDfdGroup(model, group, selected): DataFlowModel {
  // 外す / 選ぶ。上限(MAX_DFD_GROUPS)に達していれば選ぶ操作は無視する
}
export function updateSummary(model, functionId, patch): DataFlowModel {
  // 行を書き換える。まだ行が無い処理なら行を足す
}
```

```tsx
// components/DataFlowPanel.tsx
const stage1Model = useDetailedDesignStore((s) => s.stages.find((i) => i.stage === 1)?.model ?? null);
const functionList = toFunctionList(stage1Model);  // 入力の段階1(承認済み)
const saved = toDataFlow(stage.model);
const [draft, setDraft] = useState<DataFlowModel>(saved);
const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
...
<StyledButton disabled={!stage.is_open || generating || requestingGeneration || dirty}  // 保存してから生成
  onPress={() => (hasDraft(saved) ? setConfirming(true) : startGeneration())}>
```

```tsx
// components/StageWorkArea.tsx
const STAGE_PANELS: Partial<Record<number, ComponentType<StagePanelProps>>> = {
  1: FunctionListPanel,
  2: DataFlowPanel,
};
const Panel = stage.is_open ? STAGE_PANELS[stage.stage] : undefined;
```

## 設計判断

### グループの選択を保存してから生成させる

生成(バックエンド)は、保存されたグループの選択を使う。保存していない選択があるうちに生成を押せると、画面で選んだグループと違うグループの DFD が作られる。保存していない編集があるうちは生成ボタンを止め、「保存してから生成してください」と出す。

### 段階1の内容は、ストアの段階の一覧から読む

段階2のパネルは、処理概要表の行(機能一覧の処理ごと)とグループの選択肢(機能グループ)に段階1の内容が要る。パネルの props を段階1と同じ形(`projectId`・`stage`・`onDirtyChange`)にそろえるため、props で渡さずストアの `stages` から読む。段階2が開いているとき、段階1は承認済みである。

### 「段階番号 → パネル」の対応にする

Phase 16 は `stage.stage === 1` の分岐だった。段階2が2つ目の実在の消費者になったので、対応表にした(#17)。段階3以降は表に1行足すだけになる。パネルが受け取る値も型(`StagePanelProps`)で固定した。

### 表の見た目と検証の結果の一覧を切り出す

段階1のパネルの中にあった表のスタイルと検証の結果の一覧を、段階2でも使う。コピーせず `tableStyles.ts`・`StageIssueList.tsx` に切り出した(#17。駆動する消費者は `DataFlowPanel`)。切り出しは挙動を変えないリファクタなので、`FunctionListPanel` の既存のテストがそのまま番人になる。

### 生成中は、生成ボタンと処理概要表の空欄を「生成中」と表示する

生成中は生成ボタンのラベルを「生成中」にし、処理概要表の入力欄(入力・処理内容・出力)を止めて、空の欄には「生成中」を placeholder で出す。初回の生成では表が空のまま並ぶので、何も出さないと「生成が進んでいるのか、空のまま止まったのか」が分からないためである(作業後のユーザーの要望。[`q_a.md`](../q_a.md))。値の入っている欄は placeholder が出ないので、作り直しのときは前の内容が見えたまま止まる。

### 処理概要表は機能一覧の並びで出し、行を足し引きしない

表の行は段階1の処理ごとに決まる(17-1)。画面で行を追加・削除させず、行の無い処理は空の行として出し、編集した時点で行を足す(`updateSummary`)。マウント直後に空の行を足すと、何も編集していないのに「保存していない編集がある」になるためである。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `dataFlowOps` の各関数 | Vitest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 正規化、`hasDraft` の規則、上限、行の追加 |
| `StageIssueList`・`tableStyles` | Vitest + Testing Library | スタブ不要。props だけで描く | エラーと警告、指摘が無いとき |
| `DataFlowPanel` | Vitest + Testing Library(userEvent) | ストアの `save`・`generate`・`fetchStages` を `vi.fn` に差し替える(サーバーへの保存・生成の代わり)。段階の一覧は `setState` で置く | 第一テストの統合スモーク(グループを選ぶ → 保存できる・生成は止まる → 保存で `{dfd_groups, summaries}` を送る)。選択だけ保存した状態は確認なしで生成、作り直しの確認、処理概要表の編集、生成中の「生成中」の表示、失敗・検証の表示 |
| `StageWorkArea`(段階2) | Vitest + Testing Library | 同上 | 開いた段階2に「準備中」ではなくパネルを出す |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/dataFlowOps.test.ts \
  src/features/detailed-design/components/__tests__/{StageIssueList,DataFlowPanel,StageWorkArea,FunctionListPanel}.test.tsx
# 26 passed
```
