# Phase-21-6: 1関数の詳細の編集(FE)

## この章の目的

段階6の1つの関数の詳細を編集する部品(`LogicSpecEditor`)を作る。06 の見本(Phase 14 のデモ)と同じく、見出しの下に「呼ばれる手順」のバッジ、シグネチャ/引数/戻り値/例外/事前条件/事後条件の表、番号付きの擬似フローを並べる。バッジは、押したときの動き(21-8 の段階またぎ)を呼び出し元から受け取れるようにしておく。

学習モード([introduction](./Phase-21-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`components/tableStyles.ts`](../samples/frontend/src/features/detailed-design/components/tableStyles.ts) | 更新 | 定型 | `BADGE`(05↔06 のバッジの見た目。06 の呼ばれる手順と 05 の詳細バッジで共有) |
| [`components/LogicSpecEditor.tsx`](../samples/frontend/src/features/detailed-design/components/LogicSpecEditor.tsx) | 新規 | 定型 | 仕様の表・擬似フロー(段の追加・削除、1行1箇条)・呼ばれる手順のバッジ(`onStepPress` があれば押せる) |
| ── ここからテスト ── | | | |
| [`components/__tests__/LogicSpecEditor.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/LogicSpecEditor.test.tsx) | 新規 | 定型 | 欄の編集、擬似フローの段と箇条、バッジの出し分け、呼ぶ手順が無いときの印 |

## 要点の抜粋

```tsx
// components/LogicSpecEditor.tsx
export function LogicSpecEditor({ model, logicKey, logicId, stepIds, disabled, onChange, onStepPress }: {
  model: LogicModel;
  logicKey: string;            // 編集する関数の鍵(logicOps の keyOf)
  logicId: string;             // L-01(並び順から呼び出し元が導く)
  stepIds: string[];           // この関数を呼ぶ手順の手順ID
  disabled: boolean;
  onChange: (model: LogicModel) => void;
  onStepPress?: (stepId: string) => void;   // 渡すとバッジが button になる(21-8)
})
```

- 仕様の6つの欄は、見本(デモの `LogicSpec`)と同じ並びの縦の表にした。どの欄も複数行になりうるので textarea にした(シグネチャだけ等幅)。
- 呼ぶ手順が無いとき(段階5を直して呼ばれなくなった関数)は「段階5にこの関数を呼ぶ手順がありません」と赤で出す。検証のエラー `UNCALLED_LOGIC`(21-1)と同じ条件である。
- `BADGE` を `tableStyles.ts` に置いたのは、21-8 で段階5の手順の表(`ProcedureStepTable`)も同じ見た目のバッジを使うためである。06 側の部品から 05 側の部品へ見た目を import させない。

## 設計判断

### バッジの押したときの動きは呼び出し元が決める

バッジを押して段階5へ移るには、ストアの `jumpTo` と「保存していない編集があれば確かめる」が要る。それは作業領域(`LogicPanel`)が持つ情報なので、この部品は `onStepPress` を受け取るだけにした。`onStepPress` が無ければバッジは押せない表示(`span`)になる。21-7 の時点では渡さず、21-8 で渡す。部品を先に作り、作業領域で組み立てる、という Phase 18〜20 の章の順(部品 → 作業領域)と同じ形である。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `LogicSpecEditor` | render と操作(user-event) | `onChange`・`onStepPress`(呼び出し元への通知を受け取る) | 編集操作そのもの(`logicOps`)は本物を使う。欄の編集が onChange に渡る、擬似フローの段の追加・削除と1行1箇条、`onStepPress` の有無でバッジが button/表示だけになる(見た目は `BADGE`)、呼ぶ手順が無いときの印 |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/components/__tests__/LogicSpecEditor.test.tsx
# 5 passed
```
