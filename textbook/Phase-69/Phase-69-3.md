# Phase-69-3: 文書・テスト仕様書・チャットで失敗を知らせる

## この章の目的

[69-1](./Phase-69-1.md) でプロジェクトに記録した生成の失敗を、プレビュー(SCR-005)・詳細設計画面のテスト仕様書(SCR-008)・チャット(SCR-004)の上に出す。生成の終わりの検知を「`completed` になった」から「`generating` でなくなった」に改め、読んだプロジェクトの記録で成否を見分ける。あわせて、詳細設計モードのテスト仕様書を作っている最中に画面を開き直したときに、作っていると出す。

自動実装モード: on([introduction](./Phase-69-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/generation-failure.ts`](../samples/frontend/src/lib/generation-failure.ts) | 新規 | `GenerationFailure` の型・`failureFor`(対象で絞る)・`failureHeading` |
| [`src/features/dashboard/api/projects.ts`](../samples/frontend/src/features/dashboard/api/projects.ts) | 更新 | `ProjectRead.generation_failure` |
| [`src/components/errors/GenerationFailureNotice.tsx`](../samples/frontend/src/components/errors/GenerationFailureNotice.tsx) | 新規 | 失敗の知らせ(赤い枠・見出し・理由・添え書き) |
| [`src/hooks/useGenerationPolling.ts`](../samples/frontend/src/hooks/useGenerationPolling.ts) | 更新 | 終わり = `generating` でなくなった。読んだプロジェクトを渡す。読めない回は次へ持ち越す |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | `generationFailure`(読み込み・終わりで持ち、再生成で消す) |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | プレビューの上の知らせ(前の版を表示している旨) |
| [`src/features/documents/testSpecOps.ts`](../samples/frontend/src/features/documents/testSpecOps.ts) | 更新 | テスト仕様書の状態に「作っています」「前回の作成に失敗」 |
| [`src/features/documents/test-spec-store.ts`](../samples/frontend/src/features/documents/test-spec-store.ts) | 更新 | 開き直したときに作っているか・直近の失敗を読む |
| [`src/features/documents/components/TestSpecPanel.tsx`](../samples/frontend/src/features/documents/components/TestSpecPanel.tsx) | 更新 | 失敗の知らせ・時間切れの知らせ |
| [`src/features/detailed-design/components/StageStepper.tsx`](../samples/frontend/src/features/detailed-design/components/StageStepper.tsx) | 更新 | テスト仕様書の行の新しい2つの状態の色 |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | テスト仕様書の失敗・作っている状態・時間切れを渡す |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | `generationFailure`(読み込みで持ち、生成の承認で消す) |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx) | 更新 | 失敗したら移らずに読み直し、知らせを出す |
| テスト(下の「テスト観点」) | 新規・更新 | |

## 1. 終わりの検知を改める(`useGenerationPolling`)

```ts
// src/hooks/useGenerationPolling.ts(要点)
export function useGenerationPolling(
  projectId: string,
  active: boolean,
  onFinished: (project: ProjectRead) => void,   // 旧: onCompleted: () => void
): { timedOut: boolean } {
  ...
  try {
    const project = await getProject(projectId);
    if (project.status !== "generating") { onFinished(project); return; }   // 旧: === "completed"
  } catch { /* 次の回に読み直す */ }
```

- 失敗すると、サーバーは状態を生成の前に戻す。前が `completed`(生成済みの再生成)なら、今までの判定では**失敗が成功に見え**、前が `revising`・`interviewing` なら3分の上限まで「生成中」が続いた。どちらも、`generating` でなくなった時点で終わりとし、成否は呼び出し元が `generation_failure` で見分ける。
- 読めなかった回(一時的な 500 など)で待つのをやめない。今までは例外がそのまま漏れていた。
- 呼び出し元は3つ(プレビュー・チャット・詳細設計画面のテスト仕様書)。引数を1つ増やしても、受け取らない関数は型の上でそのまま渡せる。

## 2. 知らせの部品(`generation-failure.ts`・`GenerationFailureNotice`)

```ts
// src/lib/generation-failure.ts(要点)
export type GenerationFailure = { reason_code: string; message: string; targets: string[]; failed_at: string };
export function failureFor(failure, target?: string): GenerationFailure | null;  // target を渡すとその文書の失敗だけ
export function failureHeading(failure): string;  // 「前回の生成は失敗しました(2026/10/17 15:30:00)」
```

```tsx
// src/components/errors/GenerationFailureNotice.tsx(要点)
<YStack role="alert" aria-label="生成の失敗" borderColor="$red8" backgroundColor="$red2" ...>
  <Text fontWeight="700">{failureHeading(failure)}</Text>
  <Text>{failure.message}</Text>
  {note ? <Text color="$color11">{note}</Text> : null}
</YStack>
```

- **置き場**(着手時の相談。推奨どおり): 各画面の上の固定の知らせ。トーストは開き直すと消え、チャットの発言にするとプレビューでは分からない。次の生成を始めるまで残す(サーバーも受け付けで記録を消す)。
- 型は `lib` に置き、`ProjectRead`(`features/dashboard`)がそれを import する(3つの機能が使う型を、どれか1つの機能に置かない)。部品は `components/errors` に置いた(`NotFoundContent` と同じ、画面をまたぐ知らせ)。
- 生成中は出さない(各画面で `regenerating` / `generating` の間は隠す)。

## 3. プレビュー(`documents-store`・`DocumentsPageContent`)

- `fetchProjectMode` で記録を読み、`onRegenerationCompleted(projectId, project)` で終わったときの記録を持つ。`regenerate` を始めたら消す。
- 知らせはページの見出しの下に置き、文書があれば「下のプレビューは前の版を表示しています。もう一度「再生成する」を押してください。」を添える(失敗は rollback するので、作れた文書は無い)。
- 簡易モードのテスト仕様書のタブは、プレビューと同じ再生成の流れなので、ページの上の知らせだけで足りる(パネルには渡さない)。

## 4. 詳細設計モードのテスト仕様書(`test-spec-store`・`TestSpecPanel`・ステッパー)

```ts
// src/features/documents/test-spec-store.ts(要点)
async function readGeneration(projectId) {
  const project = await getProject(projectId);
  const failure = failureFor(project.generation_failure, "test_spec");
  if (project.status !== "generating") return { generating: false, failure };
  const progress = await getGenerationProgress(projectId).catch(() => null);
  return { generating: progress === null || progress.targets.includes("test_spec"), failure };
}
```

- 開き直したとき(`fetchTestSpec`)に、テスト仕様書と一緒にプロジェクトを読む。生成中で、進み具合の対象にテスト仕様書があれば作っている最中とみなす(詳細設計モードでは、プレビューからの設計書の再生成も同じ `generating` になるため)。進み具合が読めなければ作っているとみなす。
- 作っている印は**立てるだけ**にし、下ろすのはポーリングの終わり(`onGenerated`)だけにした。受け付けの直後に読んだ古い状態(まだ `generating` でない)で下ろすと、待つのが止まり、完了しても取り直さなくなるため。
- 失敗は「テスト仕様書を作り直そうとした失敗」だけを持つ(`failureFor(…, "test_spec")`)。パネルの上に出し、前の版があれば「下は前の版です。もう一度作り直してください。」を添える。
- ステッパーの行の状態に「作っています」(橙)・「前回の作成に失敗」(赤)を足した。作っている > 失敗 > 版の状態、の順に出す(失敗しても前の版は残るので、版の状態より先に知らせる)。
- 今まで詳細設計画面は3分の上限(`timedOut`)を捨てていた。パネルに渡し、「時間がかかっています。…読み込み直してください」を出す。

## 5. チャット(`hearing-store`・`ChatPageContent`)

```tsx
// src/features/hearing/components/ChatPageContent.tsx(要点)
useGenerationPolling(projectId, generationTriggered, (project) => {
  if (project.status === "completed" && !project.generation_failure) {
    router.push(`/projects/${projectId}/documents`);
    return;
  }
  void loadHistory(projectId);   // 状態・完了のバナー・失敗の記録を読み直す
});
```

- 最初の生成が失敗すると、状態は `interviewing`(または `revising`)に戻る。今までは3分の上限まで「生成しています」が続いた。読み直すと `generationTriggered` が下り、完了のバナー(「設計書を生成」)が戻って、もう一度押せる。
- 知らせは見出しの下。生成の承認(`approveAndGenerate`)で消す。

## テスト観点

| テスト | SUT | ドライバ | スタブ | 観点 |
|---|---|---|---|---|
| `src/lib/__tests__/generation-failure.test.ts`(新規) | `failureFor`・`failureHeading` | vitest | スタブ不要 ── 純粋関数で外部を呼ばないため | 記録が無ければ null / 対象で絞る / 見出しの日時 |
| `src/components/errors/__tests__/GenerationFailureNotice.test.tsx`(新規) | `GenerationFailureNotice` | render | スタブ不要 ── 渡した値を出すだけ | 見出し・理由・添え書きを alert で / 無ければ出さない |
| `src/hooks/__tests__/useGenerationPolling.test.ts` | `useGenerationPolling` | renderHook と偽のタイマー | fetch のスタブ(サーバーの代わり) | 失敗して `revising` に戻ったら記録つきのプロジェクトを渡す / 読めない回の次に読み直す |
| `documents-store.test.ts`・`DocumentsPageContent.test.tsx`・`VersionHistoryPanel.test.tsx` | 文書のストア・プレビュー | 関数の呼び出し・render | fetch のスタブ / 画面はストアの関数を `vi.fn` に差し替え | 読み込みで持ち再生成で消す / 終わりで持つ / 前の版の旨と一緒に出し再生成中は出さない / 終わりのコールバックがプロジェクトを渡す / テスト仕様書の復元の後はプロジェクトも読む(要求が1つ増える) |
| `test-spec-store.test.ts`・`testSpecOps.test.ts`・`TestSpecPanel.test.tsx` | テスト仕様書のストア・状態・パネル | 関数の呼び出し・render | fetch のスタブ / `onGenerate` | 開き直しで作っている(進み具合の対象で判断)/ テスト仕様書の失敗だけを持ち次の作成で消す / 終わりで持つ / 状態の優先順 / 失敗と時間切れの知らせ |
| `StageStepper.test.tsx`・`DetailedDesignPageContent.test.tsx` | ステッパー・詳細設計画面 | render と操作 | ストアの関数を `vi.fn` に差し替え | 「作っています」の行 / 失敗を行とパネルで知らせる |
| `hearing-store.test.ts`・`ChatPageContent.test.tsx` | ヒアリングのストア・チャット画面 | 関数の呼び出し・render | fetch のスタブ / ポーリングのフックを差し替え | 読み込みで失敗を持ち生成の承認で消す / 成功は移る・失敗は移らずに読み直す / 知らせを出し生成中は出さない |

この章で作成・更新した本体のファイルは、それぞれ上のテストが import する(`projects.ts` は型だけなので、`useGenerationPolling`・ストアを通して)。
