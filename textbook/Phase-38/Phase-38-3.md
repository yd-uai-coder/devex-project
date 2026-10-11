# Phase-38-3: 段階1の要件の欄と段階8の要件の列(FE)

## この章の目的

段階1(機能一覧)の各処理に「要件」の入力欄を置き、AI の下書き(API の処理は外部設計書から写した要件ID)を人が確かめて直せるようにする。段階8(実装手順書)の単位の一覧には、[38-2](./Phase-38-2.md) で応答に足した単位ごとの要件ID を列で出す。

自動実装モード: on([introduction](./Phase-38-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `FunctionRow.req_ids`、`DesignStageRead.unit_req_ids`(段階8だけ・古い応答には無い) |
| [`src/features/detailed-design/functionListOps.ts`](../samples/frontend/src/features/detailed-design/functionListOps.ts) | 更新 | `toFunctionList`・`addRow` に `req_ids`。「/」区切りの変換(`screensToText`・`textToScreens`)を削除 |
| [`src/features/detailed-design/components/ListInput.tsx`](../samples/frontend/src/features/detailed-design/components/ListInput.tsx) | 更新 | コメントだけ(段階1でも使う) |
| [`src/features/detailed-design/components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx) | 更新 | 「要件」の列。関連画面と要件の欄を `ListInput` に |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 単位の一覧に「要件」の列 |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeFunctionList()` の処理に `req_ids` |
| [`src/features/detailed-design/__tests__/functionListOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/functionListOps.test.ts) | 更新 | `req_ids` の既定値 |
| [`src/features/detailed-design/components/__tests__/FunctionListPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/FunctionListPanel.test.tsx) | 更新 | 要件の欄の編集と保存 |
| [`src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 更新 | 単位の一覧の要件の列 |

FE のパスは `devex-ui/` 基準。並びは import の依存順(#30)。

## 要点の抜粋

```ts
// src/features/detailed-design/api/types.ts
export type FunctionRow = {
  ...
  req_ids: string[]; // 要件ID(FR-001…)。API の処理は外部設計書の 2.6 から写した下書き
};
export type DesignStageRead = {
  ...
  unit_req_ids?: Record<string, string[]>; // 段階8だけ。単位 → 要件ID
};
```

```tsx
// src/features/detailed-design/components/FunctionListPanel.tsx(要件の欄)
<ListInput
  label={`${row.id} の要件`}
  items={row.req_ids}
  disabled={false}
  style={{ ...INPUT, ...MONO }}
  onChange={(reqIds) => setDraft((m) => updateRow(m, row.id, { req_ids: reqIds }))}
/>
```

```tsx
// src/features/detailed-design/components/ProcedureDocPanel.tsx(単位の一覧)
const unitReqIds = stage.unit_req_ids ?? {};
<td style={{ ...CELL, ...MONO }}>{(unitReqIds[unit.id] ?? []).join(", ") || "—"}</td>
```

## 設計判断

### 関連画面と要件の欄は `ListInput` を使う(#17)

段階1の関連画面の欄は、入力の文字列を毎回配列に直し、配列から文字列を作り直していた(`screensToText`・`textToScreens`)。そのため区切りの「/」を打った瞬間に消え、2つ目の画面ID を続けて書けなかった(要件の欄のテストを書いて気づいた)。段階4・7には、入力中の文字列を手元に持つ `ListInput`(「,」区切り、Phase 19・23)が既にある。要件の欄という2つ目の消費者が出たので、関連画面と要件の両方を `ListInput` にし、「/」区切りの変換は消した。表示の区切りは「/」から「, 」に変わる(保存する値は配列のまま)。

### 要件の欄は人が直せる下書き

API の処理の要件ID は外部設計書から写るが、外部設計書の対応そのものが粗いこともある。段階1の画面で直して保存すれば、その値が段階1の検証・詳細設計書の 01・手順書の「要件との対応」に使われる(再生成すると下書きに戻る。[38-1](./Phase-38-1.md))。

### 段階8の要件は応答の値を出すだけ

詳細設計モードの単位の要件は段階1から導くが、段階8のパネルは段階1の内容を持たない。バックエンドが導いた `unit_req_ids` をそのまま出す(段階3の DFD の R/W を `dfd_accesses` で渡したのと同じ考え方)。古い応答で欄が無くても「—」になる。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `functionListOps`(`toFunctionList`・`addRow`) | vitest(`functionListOps.test.ts`) | スタブ不要 ── 純粋関数のため | 保存された JSON に `req_ids` が無ければ空、追加した行も空 |
| `FunctionListPanel` | vitest + Testing Library(`FunctionListPanel.test.tsx`) | ストア(`useDetailedDesignStore`)の `save` を `vi.fn` に差し替える ── 保存の API を呼ばずに、保存される model を確かめるため | 要件の欄に下書きの値が出て、「, FR-002」と続けて打てて、配列で保存される |
| `ProcedureDocPanel` | vitest + Testing Library(`ProcedureDocPanel.test.tsx`) | ストアの操作を `vi.fn` に差し替える(既存と同じ) | 単位の行に要件の列(M-01-T02 → FR-001) |

```sh
cd devex-ui && npx vitest run src/features/detailed-design
```
