# Phase-64-3: 削除の確認とトースト(UI の部品)

## この章の目的

プロジェクトの削除ボタンを、確認・API の呼び出し・完了の知らせまで含めて1つの部品(`DeleteProjectButton`)にする。削除の前の確認は、どの画面でも同じアラートダイアログを使う。確認を通らずに API を呼ぶ経路は作らない(着手時の相談でのユーザーの指定)。削除が終わったことはトーストで知らせる。トーストの置き場はルートに置き、画面を移っても消えないようにする。画面への配置は [64-4](./Phase-64-4.md) で行う。

自動実装モード: on([introduction](./Phase-64-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`package.json`](../samples/frontend/package.json) | 更新 | `@tamagui/toast` を `2.6.0` に固定して直接の依存に足す |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | `deleteProject(projectId)` |
| [`src/features/dashboard/dashboard-store.ts`](../samples/frontend/src/features/dashboard/dashboard-store.ts) | 更新 | `removeProject(projectId)` |
| [`src/components/layout/AppToast.tsx`](../samples/frontend/src/components/layout/AppToast.tsx) | 新規 | トーストの置き場 `AppToastProvider` |
| [`src/app/providers.tsx`](../samples/frontend/src/app/providers.tsx) | 更新(テンプレート由来。samples に新規) | 子を `AppToastProvider` で包む |
| [`src/features/dashboard/components/DeleteProjectButton.tsx`](../samples/frontend/src/features/dashboard/components/DeleteProjectButton.tsx) | 新規 | 確認 → API → 一覧から外す → トースト |
| [`src/features/dashboard/api/__tests__/projects.test.ts`](../samples/frontend/src/features/dashboard/api/__tests__/projects.test.ts) | 更新 | DELETE の呼び出し先 |
| [`src/features/dashboard/__tests__/dashboard-store.test.ts`](../samples/frontend/src/features/dashboard/__tests__/dashboard-store.test.ts) | 更新 | `removeProject` |
| [`src/components/layout/__tests__/AppToast.test.tsx`](../samples/frontend/src/components/layout/__tests__/AppToast.test.tsx) | 新規 | show した題名が出る |
| [`src/app/__tests__/providers.test.tsx`](../samples/frontend/src/app/__tests__/providers.test.tsx) | 新規 | どの子からも知らせを出せる |
| [`src/features/dashboard/components/__tests__/DeleteProjectButton.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/DeleteProjectButton.test.tsx) | 新規 | 確認・成功・404・失敗・名前の無い文言 |

## 1. API の関数とストア(`deleteProject`・`removeProject`)

```ts
// src/features/dashboard/api/projects.ts
export function deleteProject(projectId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}`, { method: "DELETE" });
}

// src/features/dashboard/dashboard-store.ts
removeProject: (projectId) =>
  set((state) => ({ projects: state.projects.filter((p) => p.id !== projectId) })),
```

- `apiFetch` は 204 を `undefined` にするので、そのまま使える。
- `removeProject` は取り直さずに一覧から外す。`fetchedAt` はそのままにするので、文書の画面で削除してダッシュボードへ戻ったとき、20秒の cache の内でも削除したカードは出ない。

## 2. トーストの置き場(`AppToast.tsx`・`providers.tsx`)

責務: 操作の完了の知らせを、画面の右下に出す。知らせるときは `useToastController().show(題名)` を呼ぶ。

```tsx
// src/components/layout/AppToast.tsx
export function AppToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider duration={4000} swipeDirection="right" label="通知">
      {children}
      <CurrentToast />
      <ToastViewport position="fixed" bottom="$6" right="$4" zIndex={100000} />
    </ToastProvider>
  );
}
```

- **ルートに置く**: `providers.tsx` の `TamaguiProvider` の中で、子をこれで包む。そのため、文書の画面で削除して `router.push("/dashboard")` で移っても、トーストは消えない。
- `CurrentToast` は `useToastState()` で今のトーストを読み、`Toast.Title`(と、あれば `Toast.Description`)を出す。`Toast` は `bordered`・`elevate` を受け付けず、DOM の属性に流して React のエラーになる。そのため、枠と背景は `borderWidth`・`backgroundColor` などで書く。
- `label="通知"`: 読み上げ用の文(既定は英語の「Notification」)。
- **v2 の API を使わない理由**(作業中、ブラウザで確かめて替えた): 計画は `@tamagui/toast/v2` の `<Toaster />` と `toast.success()` だった。tamagui 2.6.0 の web では、`Toaster` が `accessibilityLabel` を DOM に渡す。そのため知らせるたびに React の警告(開発時の「1 Issue」)が出た。従来の API には、この問題が無い。
- **版を固定する**: `@tamagui/toast` はもともと tamagui の依存として入っている。`npm install @tamagui/toast@^2.6.0` では 2.7.7 になり、別の版の Tamagui の部品を大量に引き込んだ。tamagui 本体と同じ `2.6.0` に固定すると、package-lock の変更は1行で済む。

## 3. 削除ボタン(`DeleteProjectButton`)

責務: 削除の確認・API の呼び出し・一覧から外す・知らせを1つにまとめる。どの画面も、この部品を通してだけ削除する。

| props | 意味 |
|---|---|
| `projectId` | 削除するプロジェクト |
| `title?` | 名前。省いたとき(名前を読み込まない画面)は文言を「このプロジェクト」にする |
| `variant` | `icon`(ゴミ箱のアイコンだけ。`aria-label` は「「{名前}」を削除」)/ `text`(文字の「削除」。既定) |
| `onDeleted?` | 削除できた後(画面からはダッシュボードへ戻す) |

```tsx
// src/features/dashboard/components/DeleteProjectButton.tsx(要点)
const confirm = async () => {
  try {
    await deleteProject(projectId);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) { setError(...); return; }
  }
  removeProject(projectId);
  setOpen(false);
  toast.show(`${name}を削除しました`);
  onDeleted?.();
};
```

- **確認は Tamagui の `AlertDialog`**: `role="alertdialog"` になる。既存の `ConfirmDialog`(`Dialog`)は変えない。外側のクリックで閉じないのは、取り消せない操作の確認に合う。題は「プロジェクトを削除しますか」。本文は消えるもの・戻せないこと・生成中の処理が止まることを書く。
- **404 も成功と同じに扱う**: ほかのタブで先に削除したときなどは、もう無い。一覧から外して知らせる。
- **それ以外の失敗は、ダイアログを開いたまま中に出す**(`role="alert"`)。やり直せるように閉じない。
- 削除中は「削除中...」とし、両方のボタンを押せなくする(閉じることもできない)。
- 一覧のストア(`useDashboardStore`)を直接使う。ダッシュボード以外の画面から削除しても、ストアから外しておけば、戻ったときにカードが残らない。
- 置き場は `src/features/dashboard/components/`(プロジェクトの一覧の機能の部品)。`src/components/` には置かない(機能に依存しない部品の層のため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `projects.test.ts`(更新) | `deleteProject` | このテスト | `fetch`(`stubFetch`)。本文の無い 204 は作れないので、呼び出し先とメソッドだけを見る |
| `dashboard-store.test.ts`(更新) | `removeProject` | ストアの関数を直接呼ぶ | `fetch`(呼ばないことを確かめる) |
| `AppToast.test.tsx`(新規) | `AppToastProvider` | 子の部品から `useToastController().show` | スタブ不要 ── 知らせが画面に出ることそのものが検証対象で、外部に依存しないため |
| `providers.test.tsx`(新規) | `Providers` | 子の部品から `show` | `next/navigation` の `useServerInsertedHTML`・`@tamagui/next-theme`(`next/script` を読むため Vitest で評価できない) |
| `DeleteProjectButton.test.tsx`(新規) | `DeleteProjectButton` | ユーザーの操作 | `fetch`(`stubFetch`)と `useToastController`(`vi.mock`。呼ばれたことを見る)。一覧のストアは本物 |

- `DeleteProjectButton`:
  - ゴミ箱を押すとダイアログが開き、まだ API を呼ばない。キャンセルで閉じ、API は呼ばない。
  - 「削除する」で DELETE を呼び、一覧から外し、「「備品予約」を削除しました」を知らせ、`onDeleted` を呼ぶ。
  - 404 も同じに扱う。500 はダイアログの中に出し、一覧は変えず、知らせない。
  - 名前を渡さないと、本文と知らせが「このプロジェクト」になる。
- Tamagui のダイアログの中のボタンは、jsdom では表示のアニメーション中とみなされ、ロールのクエリでは隠れた扱いになる。そのため `getByLabelText` で取る(`ConfirmDialog` のテストと同じ)。ダイアログの外のボタン(ゴミ箱・「削除」)はロールで取れる。
- 作成・更新したファイルは、この章のテストがすべて import する(`package.json` は除く)。前方 import は無い。
