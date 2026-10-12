# Phase-44-4: 再生成の候補からの部分再生成

## この章の目的

「変更の影響」パネルに再生成の候補(部分再生成できる段階5 手順・段階6 処理ロジック・段階8 単位の手順書の、未確認の印の要素)を出し、段階ごとにまとめて選んで部分再生成を呼べるようにする(着手時の決定3)。自動では再生成しない([41-2](../Phase-41/Phase-41-2.md) 決定6)。

自動実装モード: on([introduction](./Phase-44-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/detailed-design/` 配下(依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`impactOps.ts`](../samples/frontend/src/features/detailed-design/impactOps.ts) | 更新 | `REGENERATION_LIMITS`(段階ごとの生成の上限)・`regenerationGroups`(候補を段階ごとに) |
| [`components/RegenerationTargets.tsx`](../samples/frontend/src/features/detailed-design/components/RegenerationTargets.tsx) | 新規 | 再生成の候補(段階ごとのチェックボックス・「選んだ候補を再生成する」) |
| [`components/ChangeImpactPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ChangeImpactPanel.tsx) | 更新 | パネルの末尾に再生成の候補 |
| ── ここからテスト ── | | |
| [`__tests__/impactOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/impactOps.test.ts) | 更新 | 段階ごとのまとめと上限 |
| [`components/__tests__/ChangeImpactPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ChangeImpactPanel.test.tsx) | 更新 | 選んだ候補で段階へ移って再生成・外すと押せない・開いていない段階と生成中 |

## 要点の抜粋

### 1. 候補の並べ方

```tsx
// src/features/detailed-design/components/RegenerationTargets.tsx
export function RegenerationTargets({ projectId, targets }: { projectId: string; targets: RegenerationTargetRead[] })
```

- 候補は `regenerationGroups` で段階の順にまとめ、段階ごとにチェックボックスで並べる。初めは上限(`REGENERATION_LIMITS`。どの段階も 5 件。devex-api の上限と同じ定数)まで全部選ぶ。選択の切り替えは既存の `procedureDocOps.toggleUnit`(上限に達したら足さない)を使う。
- 段階が開いていない・生成中・生成の受け付け中は押せない。上限より候補が多いときは、その旨を添える。
- 候補が入れ替わったら選択を初めからにする(段階ごとの部品の `key` を候補のキーの並びにする)。

### 2. 押したとき

```tsx
const start = () => {
  selectStage(stage);                         // 生成の完了は段階のパネルが待つので、先に移る
  void regenerate(projectId, stage, selected); // 44-1: 候補のキー → 生成の引数
};
```

生成の完了のポーリング(`useStageGenerationPolling`)は段階のパネルの中にあるので、先にその段階へ移る。受け付けの失敗(上限・選択の 409)は、移った先の作業領域の共通のエラー表示に出る。

## 設計判断

### 再生成しても確認済みにしない

部分再生成は下書きを作り直すだけで、その内容が変更に合っているかは人が確かめる。印は、生成した内容を確かめてから確認済みにする(パネルの説明文にも書いた)。候補は未確認の印から作られるので、確認済みにすれば候補からも消える。

### 1段階1回の生成

生成は段階ごとにバックグラウンドで1つずつ進み(生成中の段階は 409)、1回の対象の数に上限がある。段階をまたいで一度に押せる形にすると、待ちと失敗が分かりにくくなるため、段階ごとのボタンにした。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `regenerationGroups`・`REGENERATION_LIMITS` | vitest(`impactOps.test.ts`) | スタブ不要 ── 純粋関数と定数のため | 段階の順のまとめ・上限 |
| `RegenerationTargets`(`ChangeImpactPanel` から描く) | vitest + Testing Library | ストアの `regenerate`・`selectStage`(vi.fn。生成の API と段階の移動の代わり)。段階の開き・生成中はストアの `stages` で作る | 段階5の候補で段階へ移って再生成(スモーク)、外すと押せない(0件)、生成中・開いていない段階は押せない |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/__tests__/impactOps.test.ts src/features/detailed-design/components/__tests__/ChangeImpactPanel.test.tsx
```
