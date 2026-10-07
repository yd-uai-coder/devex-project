# Phase-28-4: 単位の詳細の表示と編集(FE)

## この章の目的

段階8の単位の一覧で単位の ID を押すと、その単位の詳細を開く。詳細は、参照する設計のバッジ(押すと、28-1 の API が返す展開した md を出す)と、手順書の全部の欄の編集(目的・ファイル・実装の要点・テスト観点・Given/When/Then・確認方法・AI の指摘、単位の手順書の削除)である。編集はパネルの中の下書きに持ち、保存して初めてサーバーへ送る(段階5の `ProcedurePanel` と同じ形)。

自動実装モード: on([introduction](./Phase-28-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `DesignRefRead`・`UnitContextRead` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | `getUnitContext`(`GET /design-stages/units/{unit_id}/context`) |
| [`labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `UNIT_FILE_KIND_LABELS`(モジュール・テスト・環境・設定) |
| [`procedureDocOps.ts`](../samples/frontend/src/features/detailed-design/procedureDocOps.ts) | 更新 | `FILE_KINDS` を export、`updateUnit`・`removeUnit`・`addUnitRow`・`updateUnitRow`・`removeUnitRow`(純粋) |
| [`components/UnitProcedureEditor.tsx`](../samples/frontend/src/features/detailed-design/components/UnitProcedureEditor.tsx) | 新規 | 単位の詳細(参照のバッジと展開・手順書の編集) |
| [`components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 手順書を下書きとして持ち(`dirty`・`onDirtyChange`)、単位の ID を詳細を開くボタンにし、開いた単位を `UnitProcedureEditor` で出す |
| ── ここからテスト ── | | |
| [`api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | `getUnitContext` の URL |
| [`__tests__/procedureDocOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/procedureDocOps.test.ts) | 更新 | 編集の純粋関数 |
| [`components/__tests__/UnitProcedureEditor.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/UnitProcedureEditor.test.tsx) | 新規 | 参照の展開・取得の失敗・未生成の単位・編集・「段階Nで直す」・タスク名の食い違い |
| [`components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 更新 | 詳細を開いて編集 → 保存、編集中は生成できない |

## 要点の抜粋

```ts
// procedureDocOps.ts(28-4 の分)。行は位置で扱う(行に固有の鍵が無い)
type RowKey = "files" | "tests" | "findings";
export function updateUnit(doc, unitId, patch: Partial<Omit<UnitProcedure, "unit_id" | "title">>)
export function removeUnit(doc, unitId)                    // 単位の手順書を消す
export function addUnitRow(doc, unitId, key: RowKey)       // 空の行(指摘は major・段階8)を足す
export function updateUnitRow(doc, unitId, key, index, patch)
export function removeUnitRow(doc, unitId, key, index)
```

```tsx
// components/UnitProcedureEditor.tsx
export function UnitProcedureEditor({ projectId, unit, doc, disabled, onChange, onFix }) {
  // UnitRefs: getUnitContext(projectId, unit.id) → バッジ(押すと <pre> で展開。設計に無い参照は赤で押せない)
  //           07章 横断事項・段階7 開発環境も同じバッジで出す
  // 手順書が無い単位 → 「単位の一覧で選んで生成してください」
  // ある単位 → 目的 / ファイルの表 / 実装の要点 / テスト観点の表 / GWT / 確認方法 / AI の指摘の表 / 削除
}
```

```tsx
// components/ProcedureDocPanel.tsx(下書きと詳細の部分)
const saved = toProcedureDoc(stage.model);
const [doc, setDoc] = useState<ProcedureDocModel>(saved);
const [opened, setOpenedState] = useState(() => useDetailedDesignStore.getState().tabs["8:unit"] ?? null);
// <UnitProcedureEditor key={openedUnit.id} unit={openedUnit} doc={doc} onChange={setDoc} onFix={jumpTo} />
// 保存のバー(上下)→ save(projectId, 8, doc)
```

## 設計判断

### 全部の欄を編集できる(着手時の決定4)

AI の下書きを人が直して保存できる点は、段階5・6と同じにした。ただし「手順書の上では決めない」原則は変えない。AI の指摘は、対象の段階で設計を直してから行を消す(指摘の表に「段階Nで直す」と「削除」を並べる)。単位の手順書ごとの削除は、段階7とタスク名の合わない手順書(`UNIT_MISMATCH`)を片付けるのに使う(作り直しでも直る)。

### 参照は API で読み、詳細の中だけで持つ

参照の展開は 28-1 のとおりバックエンドが返す。`UnitRefs` は単位を開いたときに読み、結果は詳細の中にだけ持つ(ストアに入れない)。設計は段階8の外で変わり、変われば段階8は「古い」になるので、開くたびに読み直せば足りる。読み込み中・失敗(段階8が開いていないなど)は詳細の中に出す。

### 開いている単位の記憶と `focus`

開いている単位は、ストアのタブの記憶(`"8:unit"`)に置く。保存・生成でパネルが作り直されても、同じ単位の詳細に戻る(段階5の `"5:procedure"` と同じ)。計画では「他の段階から来たときは `focus` で開く」としていたが、段階8へ単位を指して移る元がまだ無いので作らなかった(#17。作るなら、その元ができる Phase で)。

### 1行1項目の入力欄

実装の要点・Given/When/Then・確認方法は文なので、「,」区切りの `ListInput`(段階4・7のパスや ID の一覧向け)では、文の中の「,」で項目が割れる。段階6の擬似フローの箇条と同じく、1行1項目の `textarea`(`logicOps` の `subToText`・`textToSub` を再利用)にした。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `updateUnit`・`removeUnit`・`addUnitRow`・`updateUnitRow`・`removeUnitRow` | vitest(`procedureDocOps.test.ts`) | スタブ不要 ── 純粋で、model だけから決まるため | 対象の単位の欄・行だけが変わり、他の単位はそのまま。足す行の既定値。削除で単位が消える |
| `getUnitContext` | vitest(`designStagesApi.test.ts`) | `fetch` のスタブ(`stubFetch`) | `GET /design-stages/units/M-01-T02/context` を呼び、本文をそのまま返す |
| `UnitProcedureEditor` | vitest + Testing Library(`UnitProcedureEditor.test.tsx`) | `getUnitContext`(`vi.mock`)── サーバーの展開の代わり。`onChange`・`onFix` ── 呼び出し元(パネル)の代わり | バッジを押すと展開を出し、設計に無い参照は押せない。取得の失敗は理由を出す。手順書の無い単位は生成を促し、編集欄を出さない。編集・行の追加と削除・手順書の削除を `onChange` で返す。「段階7で直す」で `onFix(7, 対象)`。タスク名の食い違いを出す |
| `ProcedureDocPanel`(下書きと詳細) | vitest + Testing Library(`ProcedureDocPanel.test.tsx`) | ストアの `save`・`generate`・`fetchStages`、`getUnitContext`(`vi.mock`) | 単位の ID で詳細を開き、目的を直すと `onDirtyChange(true)` で生成を押せなくなる。保存で `save("p1", 8, 編集後の model)`。開いた単位をストアのタブに覚える |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design --maxWorkers=4
npx tsc --noEmit
```
