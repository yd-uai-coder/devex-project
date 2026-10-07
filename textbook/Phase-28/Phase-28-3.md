# Phase-28-3: 生成の操作と、最重要が残るときの承認前の確認(FE)

## この章の目的

SCR-008 の段階8で、単位を選んで手順書を生成できるようにする(1回に5つまで。手順書のある単位を選んだら、作り直す前に確かめる)。あわせて、段階8に最重要の指摘が残っているときは、件数を示して確かめてから承認する。承認は止めない(Phase 27 の決定「警告は承認を止めない」を保つ)。

自動実装モード: on([introduction](./Phase-28-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `MAX_PROCEDURE_DOC_TARGETS` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `generateDesignStage` に `unitIds`(本文の `unit_ids`) |
| [`detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `generate` に `unitIds` |
| [`procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 更新 | `criticalCount`(保存済みの最重要の数)・`toggleUnit`(上限つきの選択)(純粋) |
| [`components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | props に `projectId`・`onDirtyChange`。生成の選択の列・生成のボタン・作り直しの確認・生成中と失敗の表示・保存のバー |
| [`components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 段階8の承認の前に、最重要が残っていれば確認のダイアログを出す |
| ── ここからテスト ── | | |
| [`api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 段階8の `unit_ids` |
| [`__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | `generate` が `unit_ids` を渡す |
| [`__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 更新 | `criticalCount`・`toggleUnit` |
| [`components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 更新 | 選択と生成・作り直しの確認・生成の失敗 |
| [`components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 最重要が残るときの確認(OK で承認・キャンセルで承認しない) |

## 要点の抜粋

```ts
// procedureDocOps.ts(28-3 の分)
// 段階の保存済みの内容に残っている最重要の指摘の数(検証の指摘と AI の指摘の両方)
export function criticalCount(stage: DesignStageRead): number {
  return countByLevel(collectFindings(stage.issues, toProcedureDoc(stage.model))).critical;
}
// 上限に達していれば足さない(外すのはいつでもできる)
export function toggleUnit(selected: string[], id: string, max: number): string[]
```

```tsx
// components/ProcedureDocPanel.tsx(生成の部分)
const [selection, setSelection] = useState<string[]>([]);      // 保存しない。生成で作り直されると空に
const canGenerate = stage.is_open && !generating && !requestingGeneration && !dirty;
const regenerating = savedUnits.filter((u) => u.hasProcedure && selection.includes(u.id));
// 「選んだ単位の手順書を生成する(n/5)」→ regenerating があれば ConfirmDialog → generate(projectId, 8, undefined, undefined, selection)
```

```tsx
// components/DetailedDesignPageContent.tsx
const startApproval = (stage: number) => {
  const critical = current && stage === 8 ? criticalCount(current) : 0;
  if (critical > 0) setCriticalLeft(critical);   // 「最重要の未定義・要決定が N 件残っています。このまま承認しますか?」
  else void approveStage(stage);
};
```

## 設計判断

### 選択はコンポーネントの状態に持つ

段階5・6は、下書きを作る行を model に選んで保存してから生成した。段階8の単位は段階7にあり、選択は「今回どれを生成するか」だけを表すので、保存しない(デモと同じ)。上限(5)に達したら、選ばれていない単位のチェックを押せなくする。生成するとパネルが作り直され(`StageWorkArea` の `key`)、選択は空に戻る。保存していない編集(28-4)があるうちは生成できない(生成は保存した手順書に重ねるため。段階5と同じ)。

### 作り直しの確認

選んだ単位に手順書のあるものが含まれていれば、`ConfirmDialog` で、その単位の手直しが失われること(他の単位は残ること・承認済みなら承認がやり直しになること)を示してから生成する。判定は保存済みの手順書(`savedUnits`)で行う。段階7とタスク名の合わない手順書は「生成済」に数えないので、確認なしで作り直せる。

### 承認前の確認は FE だけ(着手時の決定3・Claude の判断)

最重要の指摘があっても、バックエンドは承認を止めない(Phase 27 の決定)。承認を止めると細かな不足が残るだけで手順書が使えなくなり、「設計の側で直す」流れも変わらない。一方で、最重要は「決まらないと実装に着手できない」ものなので、承認する人に気づかせたい。そこで画面だけが承認の前に件数を示して確かめる。API に `acknowledge` のような欄を足すと、承認の条件が段階8だけ変わるので足さない。

数えるのは保存済みの内容(`stage.issues` と `stage.model`)で、検証の指摘と AI の指摘の両方(画面の未定義の一覧と同じ `collectFindings`)。決定的なチェックは今は最重要を出さないので、実際には AI の指摘の数になる。

### samples の `ProcedureDocPanel.tsx` の表記

この Phase で、パネルの関数の本体を大きく書き直した(28-3 の生成、28-4 の下書き・詳細)。#29 の「旧コードをコメントアウトして新コードを続ける」をすべての行に当てると、旧い本体と新しい本体が二重に並んで読めなくなるので、旧コードのコメントアウトは要所(props・`doc` の持ち方・単位の ID のセル)だけにし、新しい塊には章のタグを付けた。ファイル冒頭にその旨を書いている。Phase 27 の版は [Phase-27-3](../Phase-27/Phase-27-3.md) を参照。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `criticalCount`・`toggleUnit` | vitest(`procedureDocOps.test.ts`) | スタブ不要 ── 純粋で、引数の段階と選択だけから決まり、ストアや API を呼ばないため | 検証と AI の最重要の両方を数える。行の無い段階は0。上限で足さず、外すのはいつでもできる |
| `generateDesignStage`・ストアの `generate` | vitest(`designStagesApi.test.ts`・`detailed-design-store.test.ts`) | `fetch` のスタブ(`stubFetch`)── HTTP の代わり | 段階8の対象を本文の `unit_ids` で送る |
| `ProcedureDocPanel`(生成) | vitest + Testing Library(`ProcedureDocPanel.test.tsx`) | ストアの `generate`・`save`・`fetchStages`(と、単位の詳細が読む `getUnitContext`)── 生成・保存の通信を起こさず、呼び出しの引数だけを見るため | 選ぶまでボタンは押せない。手順書の無い単位はそのまま生成、ある単位は確認の「作り直す」の後に生成。失敗の理由を出す |
| `DetailedDesignPageContent`(承認前の確認) | vitest + Testing Library(`DetailedDesignPageContent.test.tsx`) | ストアの `approve`・`fetchStages`・`selectStage` ── 承認の通信を起こさず、呼ばれたかだけを見るため | 最重要が残る段階8では、まず確認を出して `approve` を呼ばない。「このまま承認する」で `approve("p1", 8)`、「キャンセル」で呼ばない。最重要が無い段階(既存のテスト)は確認なしで承認する |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design --maxWorkers=4
```
