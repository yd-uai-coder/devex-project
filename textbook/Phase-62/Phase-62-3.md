# Phase-62-3: メニューからの新規作成でモードを選ぶ

## この章の目的

メニューの「新規プロジェクト作成」は `/projects/new` へ飛ぶだけだった。`toProjectMode` が mode の無いときに簡易ドキュメントモードに倒していたため、ダッシュボードと違ってモードを選べなかった。この章では、`/projects/new` を mode なし(または不正な値)で開いたときに、ダッシュボードと同じモード選択ダイアログを出す。メニューからの遷移と URL の直打ちの両方に効く。キャンセルしたらダッシュボードへ戻す(着手時の決定)。

自動実装モード: on([introduction](./Phase-62-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | `toProjectMode` は無い・不正な値で `null` |
| [`src/features/dashboard/components/ModeSelectDialog.tsx`](../samples/frontend/src/features/dashboard/components/ModeSelectDialog.tsx) | 更新 | 任意の `onCancel` |
| [`src/features/hearing/components/NewProjectPageContent.tsx`](../samples/frontend/src/features/hearing/components/NewProjectPageContent.tsx) | 更新 | mode が `null` ならダイアログを出す |
| [`src/features/dashboard/api/__tests__/projects.test.ts`](../samples/frontend/src/features/dashboard/api/__tests__/projects.test.ts) | 更新 | `null` の場合 |
| [`src/features/dashboard/components/__tests__/ModeSelectDialog.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ModeSelectDialog.test.tsx) | 更新 | キャンセルで `onCancel`(無ければ `onClose`) |
| [`src/app/projects/new/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/new/__tests__/page.test.tsx) | 更新 | mode なし・不正でダイアログ、キャンセルでダッシュボード |

ページ(`src/app/(pages)/(protected)/projects/new/page.tsx`)は変えていない。`toProjectMode(mode)` の戻り値(`null` を含む)をそのまま渡す。

## 1. mode の解釈(`projects.ts`)

```ts
// src/features/dashboard/api/projects.ts
export function toProjectMode(raw: string | string[] | undefined): ProjectMode | null {
  return raw === "simple" || raw === "detailed" ? raw : null;
}
```

- 「無いなら簡易」から「無いなら決めない」に改めた。決めない場合の扱い(ダイアログ)は画面が持つ。プロジェクトの作成の API は今までどおりモードを受ける(既定は簡易)ので、API 側は変えない。

## 2. キャンセルの分離(`ModeSelectDialog.tsx`)

```tsx
// src/features/dashboard/components/ModeSelectDialog.tsx
export function ModeSelectDialog({ open, onClose, onCancel }: {
  open: boolean; onClose: () => void; onCancel?: () => void;
}) {
  ...
  <Dialog modal open={open} onOpenChange={(next) => (next ? undefined : (onCancel ?? onClose)())}>
```

- 今までは、キャンセル(と外側の押下)もモードの選択も `onClose` を呼んでいた。作成画面ではキャンセルだけでダッシュボードへ戻したいので、キャンセルを `onCancel` に分けた。選択は今のまま `onClose()` → `router.push("/projects/new?mode=…")`。
- `onCancel` は任意で、無ければ `onClose`。ダッシュボードの使い方(閉じるだけ)は変わらない。

## 3. 作成画面(`NewProjectPageContent.tsx`)

```tsx
// src/features/hearing/components/NewProjectPageContent.tsx
export function NewProjectPageContent({ mode }: { mode: ProjectMode | null }) {
  const router = useRouter();
  if (mode === null) {
    return (
      <YStack paddingVertical="$4" gap="$6">
        <H2>新規プロジェクト</H2>
        <ModeSelectDialog open onClose={() => {}} onCancel={() => router.push("/dashboard")} />
      </YStack>
    );
  }
  ...
```

- モードを選ぶと `?mode=` 付きの URL へ移る。ページ(Server Component)が新しい `searchParams` で描き直され、`mode` が入るのでダイアログは消える。そのため `onClose` は何もしない。
- 見出しだけを残し、フォームは出さない。モードが無いと作成画面は使えないため。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `projects.test.ts`(更新) | `toProjectMode` | vitest | スタブ不要 ── 純粋関数 |
| `ModeSelectDialog.test.tsx`(更新) | `ModeSelectDialog` | Testing Library + `userEvent` | `next/navigation` の `useRouter`(`push` を記録する)。キャンセルで `onCancel` を呼び `onClose`・`push` を呼ばない / `onCancel` が無ければ `onClose` |
| `page.test.tsx`(作成画面・更新) | `NewProjectPage`(→ `NewProjectPageContent`) | ページの関数を `await` して `render` | `next/navigation`(`push` を記録)。mode なしと `unknown` でダイアログが出てフォームが出ない / キャンセルで `push("/dashboard")` / `simple`・`detailed` はフォーム |

- 既存の「mode なしなら簡易」のテストは、`?mode=simple` で開く形に書き換えた(mode なしはダイアログの側のテストへ)。
- E2E の `helpers.ts` は、ダッシュボードのボタン「新規プロジェクトを作成」とダイアログの aria-label「…で作成する」を使うので、この変更の影響を受けない(Phase 72 の全 E2E で確かめる)。
- 更新したファイルは、この章のテストがすべて import する。import に前方 import は無い(`ModeSelectDialog` は既存。`useRouter` は Next.js)。
