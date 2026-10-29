# Phase-116-2: 資料の一覧・追加・資料のページ

## この章の目的

プロジェクトの「資料」の画面(SCR-013)を作る。資料の一覧と追加(本文の貼り付けか txt / md / pdf のファイル。種類・題・日付)のページと、資料1件のページ(本文・消す)を置き、ほかの画面の見出しから移れるようにする。違いの取り出しと一覧は 116-3 でこのページに足す。

自動実装モード: on([introduction](./Phase-116-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/materials/materialOps.ts`](../samples/frontend/src/features/materials/materialOps.ts) | 更新 | フォームの型・今日の日付・足せない理由・API の入力への変換 |
| [`features/materials/components/MaterialCreateForm.tsx`](../samples/frontend/src/features/materials/components/MaterialCreateForm.tsx) | 新規 | 資料を足すフォーム |
| [`features/materials/components/MaterialList.tsx`](../samples/frontend/src/features/materials/components/MaterialList.tsx) | 新規 | 資料の一覧の表 |
| [`features/materials/components/MaterialsPageContent.tsx`](../samples/frontend/src/features/materials/components/MaterialsPageContent.tsx) | 新規 | 一覧と追加の画面 |
| [`features/materials/components/MaterialDetailContent.tsx`](../samples/frontend/src/features/materials/components/MaterialDetailContent.tsx) | 新規 | 資料1件の画面(本文・消す) |
| [`app/projects/[id]/materials/page.tsx`](../samples/frontend/src/app/projects/[id]/materials/page.tsx) | 新規 | 一覧のページ |
| [`app/projects/[id]/materials/[mid]/page.tsx`](../samples/frontend/src/app/projects/[id]/materials/[mid]/page.tsx) | 新規 | 資料のページ |
| [`features/change-requests/components/ChangeRequestsPageContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestsPageContent.tsx)・[`baselines/components/BaselinesPageContent.tsx`](../samples/frontend/src/features/baselines/components/BaselinesPageContent.tsx)・[`confirmations/components/ConfirmationsPageContent.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationsPageContent.tsx)・[`detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx)・[`documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 見出しのリンクに「資料」(詳細設計モードだけ) |
| [`features/materials/test-utils/resetMaterialsStore.ts`](../samples/frontend/src/features/materials/test-utils/resetMaterialsStore.ts) | 新規 | 部品のテストのストアの準備 |
| [`features/materials/__tests__/materialOps.test.ts`](../samples/frontend/src/features/materials/__tests__/materialOps.test.ts) | 更新 | フォームの止め方と変換 |
| [`features/materials/components/__tests__/MaterialsPageContent.test.tsx`](../samples/frontend/src/features/materials/components/__tests__/MaterialsPageContent.test.tsx) | 新規 | 一覧・貼り付けとファイルで足す・移る |
| [`features/materials/components/__tests__/MaterialDetailContent.test.tsx`](../samples/frontend/src/features/materials/components/__tests__/MaterialDetailContent.test.tsx) | 新規 | 本文・確かめてから消す・無い資料 |
| [`app/projects/[id]/materials/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/materials/__tests__/page.test.tsx)・[`[mid]/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/materials/[mid]/__tests__/page.test.tsx) | 新規 | params を渡し RequireAuth で守る |
| 見出しを変えた5つの画面のテスト(`ChangeRequestsPageContent`・`BaselinesPageContent`・`ConfirmationsPageContent`・`DetailedDesignPageContent`・`DocumentsPageContent` の `__tests__`) | 更新 | 「資料」のリンク(簡易モードでは出ない) |

## 1. 置き場(着手時の決定1)

- 独立のページ `/projects/{id}/materials`(一覧と追加)と `/projects/{id}/materials/{mid}`(本文と違いの一覧)。今の CR・合意済みの版の画面と同じ形(一覧のページ + 1件のページ)で、CR の一覧を長くしない。
- ページは params を解決して Client Component に渡すだけ(Server Component から Tamagui を import しない。devex-ui の CLAUDE.md)。
- 簡易モードではサーバーが 409 を返すので、CR の画面と同じ `DetailedModeOnlyNotice` を出す。

## 2. 足すフォーム(着手時の決定3)

```ts
// src/features/materials/materialOps.ts(抜粋)
export type MaterialForm = { kind; title; materialDate; source: "paste" | "file"; body; file: File | null };
export function materialFormBlocker(form: MaterialForm): string | null   // 題・日付・本文の長さ・形式・大きさ
export function toMaterialInput(form: MaterialForm): MaterialInput | null
```

- 本文の上限(20,000文字)とファイルの形式・大きさ(txt / md / pdf・2MB)は、サーバーと同じ値で送る前に止める(Claude の判断)。本文の欄の下に文字数を出す。
- **足すと取り出すを分ける**: 足したら資料のページへ移る。違いの取り出しは資料のページで、比べる最新の束とその鮮度を見せてから行う(LLM を呼ぶ前に、古い束と比べることに気づけるように。取り出しに失敗しても資料は残る)。

## 3. 資料のページ

- 見出しに種類・日付・出どころ(貼り付け / PDF(ファイル名))・文字数、本文は枠の中で送る(`<pre>`)。
- 消すと、その資料から取り出した違いも消える(CR は残る。Phase 113)ので、枠の中で確かめてから消し、一覧へ戻る。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `materialOps.test.ts`(フォーム) | `materialFormBlocker`・`toMaterialInput`・`todayInput` | vitest のテスト関数 | スタブ不要 ── 純粋で外部依存を呼ばないため |
| `MaterialsPageContent.test.tsx` | `MaterialsPageContent` と、その中の `MaterialList`・`MaterialCreateForm` | Testing Library(描画・入力・クリック) | 資料のストアの関数(vi.fn)と router ── 画面の配線(読み込み・入力から足す入力の組み立て・移動)だけを見るため |
| `MaterialDetailContent.test.tsx` | `MaterialDetailContent` | 同上 | 同上 |
| ページの2本 | `page.tsx` | ページの関数を呼んで描く | 中身の部品(vi.mock)── params の受け渡しと RequireAuth だけを見るため |
| 見出しの5つの画面 | 各画面 | Testing Library | 既存のスタブのまま ── 「資料」のリンクの先を確かめる |
