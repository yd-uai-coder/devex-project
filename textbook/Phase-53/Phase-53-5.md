# Phase-53-5: 段階6・7 のボタンと手順書の知らせ

## この章の目的

段階6・7 の区切りはボタンで流す([51-2](../Phase-51/Phase-51-2.md) の決定2)。パネルの区切りの表のボタンに加えて、段階6・7 を承認したときの「承認しました」のダイアログから、その区切りのレビューを流せるようにする。実装手順書を生成するときは、そろっているのにレビューしていない(または失敗した)区切りを知らせる(止めない)。

自動実装モード: on([introduction](./Phase-53-introduction.md) 参照)。

## この章で作成・更新したファイル

パスは `devex-ui/` から(#30 の依存順)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 生成を始めたときに `unreviewedNotice` を出す |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 承認のダイアログの「AI 設計レビューをする」(段階6・7、オンのときだけ) |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | ダイアログからのレビュー・オフなら出さない |
| [`src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx) | 更新 | 知らせ・オフなら知らせない |

## 要点の抜粋

### 1. 承認のダイアログ

```tsx
// src/features/detailed-design/components/DetailedDesignPageContent.tsx
const reviewGate: ReviewGate | null =
  reviewEffective && !simple ? (approvedStage === 6 ? "stage6" : approvedStage === 7 ? "stage7" : null) : null;
```

- ダイアログの説明(`Dialog.Description`)は段落なので、ブロック要素(`XStack` など)を入れず、文とボタンだけを並べた。
- 押すと `runReview(projectId, gate)` を呼び、ダイアログを閉じる。結果はパネル(受け付けた後は「レビュー中」)とチャットの一行に出る。
- 「次の段階へ進む」はそのまま残す(レビューは任意。段階8 の作業を止めない)。

### 2. 手順書の生成のときの知らせ

```tsx
// src/features/detailed-design/components/ProcedureDocPanel.tsx
const startGeneration = () => {
  setConfirming(false);
  setReviewNotice(reviewEffective ? unreviewedNotice(reviewGates) : null);
  void generate(projectId, stage.stage, undefined, undefined, selection);
};
```

区切りはパネルが取った状態(レビューのストア)を読む。生成は止めない。簡易モードは文書の区切りだけを見る(簡易の区切りは documents だけ)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DetailedDesignPageContent`(承認のダイアログ) | render と操作 | 段階のストアの `approve`(承認できたことにする)、レビューのストアの `me`・`runReview` | オンで段階6 を承認するとダイアログに出て、押すと `runReview("p1", "stage6")` を呼んで閉じる・オフなら出さない |
| `ProcedureDocPanel`(知らせ) | render と操作 | 段階のストアの `generate`、レビューのストアの `me`・`gates`(状態を置くだけ) | オンで段階7 が未レビューなら生成を呼んだうえで知らせる・オフなら知らせない |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx src/features/detailed-design/components/__tests__/ProcedureDocPanel.test.tsx
```
