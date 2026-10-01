# Phase-15-7: モード選択と、詳細設計画面(SCR-008)の骨格(FE)

## この章の目的

- **モード選択**: ダッシュボードの「新規プロジェクトを作成」で、モード(簡易ドキュメント / 詳細設計)を選ぶダイアログを開く。選んだモードで作成する。
- **文書画面の出し分け**: 詳細設計モードでは「設計図を生成する」を隠し、「詳細設計へ進む」を出す(内部設計書が無いため)。
- **SCR-008 の骨格**: 左に段階1〜7のステッパー、右に選んだ段階の作業領域を置く。作業領域は、全段階に共通の部分(状態・足りない入力・古い表示・承認)だけを持つ。段階ごとの中身は Phase 16 以降で足す。

学習モード([introduction](./Phase-15-introduction.md) 参照)。

## この章で作成・更新したファイル

ページのパスは本体では `src/app/(pages)/(protected)/...`、samples では慣例どおり `src/app/...` に置いた。

| ファイル(`devex-ui/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | 定型 | `toProjectMode`(クエリの文字列をモードにする) |
| [`src/features/dashboard/components/ModeSelectDialog.tsx`](../samples/frontend/src/features/dashboard/components/ModeSelectDialog.tsx) | 新規 | **コア** | `MODE_OPTIONS`、`ModeSelectDialog`(選ぶと `/projects/new?mode=` へ) |
| [`src/app/dashboard/page.tsx`](../samples/frontend/src/app/dashboard/page.tsx) | 更新 | 定型 | 作成画面へのリンクを、ダイアログを開くボタンに替える |
| [`src/features/hearing/components/IntakeForm.tsx`](../samples/frontend/src/features/hearing/components/IntakeForm.tsx) | 更新 | 定型 | `mode` を受け取り、作成の API へ渡す |
| [`src/features/hearing/components/NewProjectPageContent.tsx`](../samples/frontend/src/features/hearing/components/NewProjectPageContent.tsx) | 新規 | 定型 | 作成画面の本体(モードの表示とフォーム) |
| [`src/app/projects/new/page.tsx`](../samples/frontend/src/app/projects/new/page.tsx) | 更新 | 定型 | `searchParams` から `mode` を読む(非同期の Server Component) |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | 定型 | `projectMode`、`fetchProjectMode` |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 定型 | モードで遷移先のリンクを出し分ける |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 新規 | **コア** | `STAGE_TITLES`、`STATE_LABELS`、`describeMissingInput`、`canApprove` |
| [`src/features/detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 新規 | **コア** | `fetchStages`、`selectStage`、`approve`、`firstPendingStage` |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 新規 | 定型 | 段階1〜7と状態の色 |
| [`src/features/detailed-design/components/StageWorkArea.tsx`](../samples/frontend/src/features/detailed-design/components/StageWorkArea.tsx) | 新規 | **コア** | 足りない入力・古い表示・承認(承認し直す)ボタン |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 新規 | 定型 | ストアと部品の配線 |
| [`src/app/projects/[id]/detailed-design/page.tsx`](../samples/frontend/src/app/projects/[id]/detailed-design/page.tsx) | 新規 | 定型 | SCR-008 のルート |
| ── ここからテスト ── | | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 新規 | 定型 | `makeStages`(段階1〜7の雛形) |
| [`src/features/dashboard/api/__tests__/projects.test.ts`](../samples/frontend/src/features/dashboard/api/__tests__/projects.test.ts) | 新規 | 定型 | `toProjectMode` |
| [`src/features/dashboard/components/__tests__/ModeSelectDialog.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ModeSelectDialog.test.tsx) | 新規 | 定型 | 2つのモードの説明、選んだモードで遷移 |
| [`src/app/dashboard/__tests__/page.test.tsx`](../samples/frontend/src/app/dashboard/__tests__/page.test.tsx) | 更新 | 定型 | ボタンでダイアログが開く |
| [`src/features/hearing/components/__tests__/IntakeForm.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/IntakeForm.test.tsx) | 更新 | 定型 | `mode` が送られる |
| [`src/app/projects/new/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/new/__tests__/page.test.tsx) | 更新 | 定型 | `?mode=` の有無 |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 更新 | 定型 | `fetchProjectMode` |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 定型 | モードでリンクが変わる |
| [`src/features/detailed-design/__tests__/labels.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/labels.test.ts) | 新規 | 定型 | 足りない入力の言葉、承認できる条件 |
| [`src/features/detailed-design/__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 新規 | **コア** | 最初に開く段階、承認後の取り直し、版の競合 |
| [`src/features/detailed-design/components/__tests__/StageStepper.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageStepper.test.tsx) | 新規 | 定型 | 状態つきの並びと選択 |
| [`src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StageWorkArea.test.tsx) | 新規 | **コア** | 開いていない・レビュー中・古い・失敗 |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 新規 | 定型 | 取得・承認の配線、取得の失敗 |
| [`src/app/projects/[id]/detailed-design/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/detailed-design/__tests__/page.test.tsx) | 新規 | 定型 | `params` の受け渡し |

## 要点の抜粋

```tsx
// src/app/(pages)/(protected)/projects/new/page.tsx(本体のパス)
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { mode } = await searchParams;
  return (
    <RequireAuth>
      <NewProjectPageContent mode={toProjectMode(mode)} />
    </RequireAuth>
  );
}
```

```ts
// src/features/detailed-design/labels.ts
export function canApprove(stage: DesignStageRead): boolean {
  return (
    stage.is_open &&
    stage.version !== null &&
    (stage.state === "draft" || stage.state === "reviewing" || stage.state === "outdated")
  );
}
```

```ts
// src/features/detailed-design/detailed-design-store.ts(approve)
try {
  await approveDesignStage(projectId, stage, current.version);   // 見ていた版で承認する
} catch (err) {
  set({ actionError: messageOf(err, "承認に失敗しました") });     // VERSION_CONFLICT は「読み込み直しました」
} finally {
  set({ approving: false });
}
await get().fetchStages(projectId);   // 後ろの段階が開く・古いが消えるので、全段階を取り直す
```

## 設計判断

### モードは、作成画面へのクエリで渡す

作成画面(`/projects/new`)は、ダイアログではなく独立したページである。モード選択のダイアログをダッシュボードに置き、選んだ結果を `?mode=` で渡した。作成画面の中にモードの選択欄を置く案もあったが、「最初にモードを選ぶ」([`docs/external_design.md`](../../docs/external_design.md) 2.2節の遷移)と順序が合わない。

`searchParams` を読むために、作成画面のページは非同期の Server Component にした。Tamagui を使う本体は `NewProjectPageContent` に切り出した。他の動的なページ(`params` を読む)と同じ形である。Next.js の page ファイルは default 以外を export できないので、文字列をモードにする関数(`toProjectMode`)は `projects.ts` に置いた。

### 画面の状態はバックエンドが決めたものを出すだけ

ステッパーの5つの状態・開いているか・足りない入力は、バックエンド(15-2 の `derive_states`)が返したものをそのまま出す。画面で同じ規則を持つと、2か所で食い違う。画面が持つ規則は、承認ボタンを押せるか(`canApprove`)だけである。

### 承認の後は、全段階を取り直す

1つの段階を承認すると、次の段階が開く。古かった段階を承認し直すと、後ろの段階の「古い」が消えることもある。承認の応答はその段階1つ分なので、全段階を取り直して画面をそろえる。

### 作業領域は「準備中」を出す

段階ごとの下書きの生成・編集は、まだ無い。作業領域には、開いている段階なら「準備中」、開いていない段階なら「前の段階を承認すると始められる」を出す。この画面からは、まだ段階の内容を作れない(保存の API はある)。Phase 16 で段階1の画面を足すと、ここが置き換わる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `toProjectMode`・`describeMissingInput`・`canApprove`・`firstPendingStage` | vitest | スタブ不要。純粋関数のため | |
| `useDetailedDesignStore` | vitest(ストアのアクションを直接呼ぶ) | `stubFetch`(fetch の代わり) | 承認の本文の版、承認後の取り直し、409 の文言 |
| `ModeSelectDialog` | vitest + Testing Library | `next/navigation` の `useRouter` をモック | ダイアログ内のボタンは、jsdom ではロールのクエリで「隠れている」扱いになる。そのため aria-label で取る |
| `StageStepper`・`StageWorkArea` | vitest + Testing Library | スタブ不要。props だけで描くため | Tamagui の Button の無効は `aria-disabled` で確かめる |
| `DetailedDesignPageContent`・`DocumentsPageContent` | vitest + Testing Library | ストアのアクションを `vi.fn()` に差し替える | 配線だけを見る |
| 各ページ | vitest(ページ関数を直接 await) | 本体のコンポーネントをモック | `params`・`searchParams` の受け渡し |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/dashboard "src/app/(pages)/(protected)/dashboard" "src/app/(pages)/(protected)/projects/new" \
  src/features/hearing/components/__tests__/IntakeForm.test.tsx src/features/documents src/features/detailed-design \
  "src/app/(pages)/(protected)/projects/[id]/detailed-design"
# 110 passed(15-8 の追記分を含む最終状態での件数)
npm run build   # /projects/[id]/detailed-design が動的ルートとして出る
```
