# Phase-11-4: 生成・一覧画面(受け付け・ポーリング・生成履歴)

## この章の目的

`/projects/[id]/uml` を、Phase 7 のスパイクから本実装に置き換える。この画面では次のことを行う。

- 生成対象を選んで生成を指示する(`POST /diagrams`、202)。
- 生成中の図がある間、図の一覧と生成履歴をポーリングする。
- 止まった理由と「再度の生成指示が必要なこと」を生成履歴に表示する。
- 図の一覧からレビュー画面(11-5)へ移る。

ドキュメント画面(SCR-005)には、この画面への「設計図を生成する →」リンクを置く。

学習モード([introduction](./Phase-11-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/hooks/useGenerationPolling.ts`](../samples/frontend/src/hooks/useGenerationPolling.ts) | 更新 | 定型 | `POLL_INTERVAL_MS`・`POLL_TIMEOUT_MS` を export する(UML のポーリングが再利用する) |
| [`src/features/uml/uml-store.ts`](../samples/frontend/src/features/uml/uml-store.ts) | 新規 | **コア** | `diagrams`・`candidates`・`runs` と `fetchAll`・`refresh`・`generate`、`isGenerating` |
| [`src/features/uml/labels.ts`](../samples/frontend/src/features/uml/labels.ts) | 新規 | 定型 | 記法・状態・結果・理由コードの表示ラベル、`diagramTitle` |
| [`src/features/uml/hooks/useUmlGenerationPolling.ts`](../samples/frontend/src/features/uml/hooks/useUmlGenerationPolling.ts) | 新規 | **コア** | 生成中の間 `refresh` を呼ぶ。3分で打ち切り、`resetTimeout` で再開する |
| [`src/features/uml/components/GenerationPanel.tsx`](../samples/frontend/src/features/uml/components/GenerationPanel.tsx) | 新規 | **コア** | component・ER(全体図/部分図)・DFD(個別/一括、最大5件)の生成指示、旧形式の警告 |
| [`src/features/uml/components/GenerationRunHistory.tsx`](../samples/frontend/src/features/uml/components/GenerationRunHistory.tsx) | 新規 | **コア** | 実行ごとの状態と、対象ごとの結果・止まった理由(`describeResult`) |
| [`src/features/uml/components/DiagramList.tsx`](../samples/frontend/src/features/uml/components/DiagramList.tsx) | 新規 | 定型 | 図の一覧とレビュー画面へのリンク。生成中はリンクにしない |
| [`src/features/uml/components/UmlPageContent.tsx`](../samples/frontend/src/features/uml/components/UmlPageContent.tsx) | 更新 | 定型 | スパイクを置き換える。取得・ポーリング・打ち切り表示と子コンポーネントの配置 |
| [`src/app/projects/[id]/uml/page.tsx`](../samples/frontend/src/app/projects/[id]/uml/page.tsx) | 更新 | 定型 | スパイクの注記を差し替える(コードは変えない) |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 定型 | 「設計図を生成する →」リンクを追加する |
| ── ここからテスト ── | | | |
| [`src/features/uml/__tests__/uml-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-store.test.ts) | 新規 | **コア** | 下記テスト観点参照 |
| [`src/features/uml/hooks/__tests__/useUmlGenerationPolling.test.ts`](../samples/frontend/src/features/uml/hooks/__tests__/useUmlGenerationPolling.test.ts) | 新規 | **コア** | 同上 |
| [`src/features/uml/components/__tests__/GenerationPanel.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/GenerationPanel.test.tsx) | 新規 | **コア** | 同上 |
| [`src/features/uml/components/__tests__/GenerationRunHistory.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/GenerationRunHistory.test.tsx) | 新規 | 定型 | 同上 |
| [`src/features/uml/components/__tests__/DiagramList.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/DiagramList.test.tsx) | 新規 | 定型 | 同上 |
| [`src/features/uml/components/__tests__/UmlPageContent.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/UmlPageContent.test.tsx) | 更新 | 定型 | スパイクの描画確認を、配線のテストに置き換える |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 定型 | リンクのケースを追加する |

## 要点の抜粋

```ts
// src/features/uml/uml-store.ts
export function isGenerating(diagrams: UmlDiagramRead[]): boolean {
  return diagrams.some((d) => d.generation_status === "generating");
}
generate: async (projectId, request) => {
  await generateDiagrams(projectId, request);  // 202。対象の図はこの時点で generating
  await get().refresh(projectId);              // 一覧を取り直す → isGenerating が true → ポーリング開始
}
```

```ts
// src/features/uml/hooks/useUmlGenerationPolling.ts
export function useUmlGenerationPolling(projectId, active): { timedOut; resetTimeout } {
  const timedOut = elapsedMs >= POLL_TIMEOUT_MS;               // 4文書生成と同じ3分
  useInterval(() => { setElapsedMs(+POLL_INTERVAL_MS); void refresh(projectId).catch(() => {}); },
              active && !timedOut ? POLL_INTERVAL_MS : null);
}
```

```tsx
// src/features/uml/components/UmlPageContent.tsx
const generating = isGenerating(diagrams);
const { timedOut, resetTimeout } = useUmlGenerationPolling(projectId, generating);
// timedOut なら「自動更新を止めました」+「再読み込み」(resetTimeout と fetchAll force)
```

`uml-store.ts` は `umlApi.ts`(11-2)と `lib/api/cache.ts` に依存する。コンポーネントはストアだけを読み、API を直接呼ばない。

## 設計判断

### 「生成中か」を図の一覧から導く

ポーリングを始める条件は、ストアに別のフラグ(例: 4文書生成の `regenerating`)を持たせず、`diagrams` の `generation_status` から `isGenerating` で導く。

- 他のタブで生成を始めた場合や、画面を開き直した場合でも、一覧を取れば正しくポーリングが始まる。
- 生成ボタンの無効化も同じ条件で行う。バックエンドは、プロジェクト内に generating の図があると 409 `UML_GENERATION_IN_PROGRESS` を返す(Phase 10)。画面の条件をそれと揃えた。

ポーリングで取り直すのは、図の一覧と生成履歴だけである。候補(`/candidates`)は内部設計書が変わらない限り変わらないため、取り直さない。

### 打ち切りの3分は既存の値の再利用(推奨値)

打ち切り時間は、4文書生成の `POLL_TIMEOUT_MS`(3分)を再利用した。UML 生成向けに実測した値ではない。打ち切るのは、プロセスが落ちると `generating` が残り続けるという既知の制約(Phase 10)があるためである。打ち切らないと、ポーリングが永遠に続く。

打ち切った後は「再読み込み」ボタンで、経過時間を戻して取り直す。一括生成(最大5件)で3分を超えることは起こりうる。その場合もボタンで続きを待てる。

### 生成対象の選び方(Phase 10 の決定を UI に写す)

- **component**: プロジェクトに1枚。`subjects: []`。
- **ER**: テーブルが30件以下なら全体図(`subject: ""`)。30件を超えたら、テーブルのチェックボックスとグループ名で部分図を作る(30件はバックエンドの上限。`ER_WHOLE_DIAGRAM_TABLE_LIMIT`)。
- **DFD**: 処理ごとの「生成」ボタン(個別)と、チェックボックスでの一括生成。一括は `MAX_SUBJECTS_PER_REQUEST=5` 件までで、5件選ぶと残りのチェックボックスを無効にする。
- **旧形式の内部設計書**: `dfd_subjects` が空で内部設計書がある場合は、「処理別データフロー」節が無い旧形式と判断し、再生成を促してドキュメント画面へ案内する。

### 止まった理由の見せ方

図の数に上限を設けない代わりに、止まった理由を生成履歴で見せる(Phase 10 の決定6)。`describeResult` は、成功以外の結果について「結果(理由)。再度の生成指示が必要です」という形の文にする。理由は `reason_code` を日本語のラベルにし、コードが無ければ `message` を使う。クォータ超過の後に残った対象は「未着手」と表示する。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 見ること |
|---|---|---|---|
| `useUmlStore` | vitest(ストアのアクションを直接呼ぶ) | `stubFetch`(fetch をキューの応答に置き換える) | 3つの GET をまとめて取得、キャッシュ(別プロジェクトなら取る)、受け付け後の取り直し、409 の detail を `generateError` へ |
| `useUmlGenerationPolling` | `renderHook` + fake timers | ストアの `refresh` を `vi.fn` に置き換える | active でなければ呼ばない、間隔ごとに呼ぶ、打ち切りと再開 |
| `GenerationPanel` | `render` + `userEvent` | ストアの `generate` を `vi.fn` に置き換え、状態は `setState` で与える | 記法ごとの生成指示の形、5件の上限、ER 部分図、旧形式の警告、生成中の無効化 |
| `GenerationRunHistory`・`DiagramList` | `render` | スタブ不要。ストアの状態を `setState` で与えて表示を見るだけで、呼び出される依存が無いため | 理由の文言、処理待ち、リンクの有無 |
| `UmlPageContent` | `render` + `userEvent` | ポーリングのフックを `vi.mock`、子コンポーネントを null に置き換える | 取得の呼び出し、ポーリングへ渡す active、打ち切り後の再読み込み |

**テストでの注意**: fake timers で打ち切りまで進めるとき、`advanceTimersByTimeAsync(3分)` を1回で呼ぶと、その間 React が再レンダーしない。そのため `timedOut` が反映されず、間隔が止まらない(期待36回に対して38回呼ばれた)。1間隔ずつ `act` で進め、実際のブラウザと同じ進み方にして解決した。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml src/features/documents src/hooks
# 15 files / 74 passed(11-4 完了時点)
npx tsc --noEmit
# エラーなし
```
