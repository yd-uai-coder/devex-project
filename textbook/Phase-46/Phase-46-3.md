# Phase-46-3: 簡易モードの影響の画面

## この章の目的

46-2 で記録した段階8の印を、簡易モードの実装手順書の画面(SCR-008 の簡易モード)に出す。Phase 44 の「変更の影響」パネルと、段階8の単位の一覧の行の印(`useStageImpact`)はそのまま使い、簡易モードを外していた2か所だけを直す。

自動実装モード: on([introduction](./Phase-46-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/detailed-design/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`impactOps.ts`](../samples/frontend/src/features/detailed-design/impactOps.ts) | 更新 | `mayHaveImpact`: 簡易モードは記録した印があるときだけ影響を取る |
| [`components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 簡易モードでも `ChangeImpactPanel` を出す |
| ── ここからテスト ── | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeSimpleImpact`(内部設計書の DF-1 が消え、段階8の U-002 に印) |
| [`__tests__/impactOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/impactOps.test.ts) | 更新 | 簡易モードの判定 |
| [`components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 簡易モードでパネルが出る |

## 要点の抜粋

```ts
// src/features/detailed-design/impactOps.ts
export function mayHaveImpact(stages: DesignStageRead[]): boolean {
  const recorded = (s: DesignStageRead) => (s.impact_open ?? 0) + (s.impact_reviewed ?? 0) > 0;
  if (stages[0]?.mode === "simple") return stages.some(recorded);
  if (stages[0]?.mode !== "detailed") return false;
  return stages.some(
    (s) => recorded(s) || (s.approved_version !== null && s.state !== "approved"),
  );
}
```

- **簡易モードは「承認の後の編集」では取らない**。文書を再生成すると段階8は「古い」になる(承認の後に state が変わる)が、簡易モードには pending の印が無いので、記録した印があるときだけ取る。印の無い簡易モードのプロジェクトは今までどおり影響の API を呼ばない。
- **パネルはそのまま使える**。段階の絞り込み(選んでいる段階に追従)は段階8だけ、変わったものは文書の要素(置き場0)なので出どころ「内部設計書」と「文書を開く」のリンクが出る。確認済みの操作・再生成の候補(段階8の単位のキー → 今の表示の ID。`regenerationArgs` は簡易モードの `plan` でも引ける)も変えていない。
- 段階8の単位の一覧の行の印は Phase 44 から `useStageImpact` を簡易モードでも呼んでいた(影響が null なので出なかった)。影響を取るようになったので、そのまま出る。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `mayHaveImpact` | vitest(`impactOps.test.ts`) | スタブ不要 ── 純粋関数で、API・ストアを呼ばないため | 簡易モードは未確認・確認済みの印があれば取る、「古い」だけでは取らない |
| `DetailedDesignPageContent`(簡易モード) | vitest + Testing Library(ストアの状態を `setState` で置く) | スタブ: ストアの `fetchStages` などの操作を `vi.fn()` に差し替える(既存のテストと同じ) | パネルに出どころ「内部設計書」・「文書を開く」のリンク・単位の手順書のラベル |

```sh
cd devex-ui && npx vitest run src/features/detailed-design --maxWorkers=4
```
