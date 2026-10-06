# Phase-12-5: FE の承認・出力の操作と注意書き(M7・D6)

## この章の目的

レビュー画面(`/projects/[id]/uml/[diagramId]`)に、承認と出力の操作を足す。Phase 11 までの状態表示は読み取り専用だった。新しいコンポーネント `DiagramReviewActions` に、状態の表示・承認ボタン・出力ボタン・2つの注意書きをまとめる。

- **M7 の注意書き**: 承認済みの図を保存すると、レビュー中に戻る。
- **D6 の注意書き**: ダウンロードしたファイルを編集しても、Devex には反映されない。

ストアには `approve`(未保存の変更があれば先に保存)と `exportDiagram`(ファイルを保存させ、図を取り直す)を足す。

文書の `.md` ダウンロード(Phase 3-6)と UML の出力で、Content-Disposition からファイル名を取り出す処理と、ファイルを保存させる処理が重なる。そこで、この2つを `src/lib/api/download.ts` に移して共有する(#17)。

自動実装モード: on([introduction](./Phase-12-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/lib/api/download.ts`](../samples/frontend/src/lib/api/download.ts) | 新規 | 定型 | `parseFilename(header)`(`documentsApi.ts` から移動)、`saveFile(filename, content, mimeType)`(`DocumentMarkdownView.tsx` から移動) |
| [`src/lib/api/client.ts`](../samples/frontend/src/lib/api/client.ts) | 更新 | 定型 | `toApiError` を export する(出力の失敗も `code` 付きの `ApiError` にするため) |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | 定型 | `parseFilename` を `download.ts` から import する |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 定型 | 保存処理を `saveFile` に置き換える |
| [`src/features/uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 更新 | 定型 | `LayoutEdgeGeometry.label_pos?`(12-2)、`UmlDiagramApprove`、`ExportFormat` |
| [`src/features/uml/api/umlApi.ts`](../samples/frontend/src/features/uml/api/umlApi.ts) | 更新 | 定型 | `approveDiagram(projectId, id, version)`、`exportDiagram(projectId, id, format) -> {filename, content, mimeType}` |
| [`src/features/uml/uml-editor-store.ts`](../samples/frontend/src/features/uml/uml-editor-store.ts) | 更新 | **コア** | `approving`/`exporting`、`approve()`、`exportDiagram(format)`。承認の失敗を `code` で分ける |
| [`src/features/uml/components/DiagramReviewActions.tsx`](../samples/frontend/src/features/uml/components/DiagramReviewActions.tsx) | 新規 | 定型 | 状態ごとのボタンの出し分けと、M7・D6 の注意書き |
| `src/features/uml/components/UmlDiagramPageContent.tsx` | 更新 | 定型 | 状態表示を `DiagramReviewActions` に置き換え、承認・出力の最中は他の操作を止める |
| ── ここからテスト ── | | | |
| [`src/lib/api/__tests__/download.test.ts`](../samples/frontend/src/lib/api/__tests__/download.test.ts) | 新規 | 定型 | `filename*` の優先・`filename` への後退・null、リンクをクリックして後片付けすること |
| [`src/features/uml/api/__tests__/umlApi.test.ts`](../samples/frontend/src/features/uml/api/__tests__/umlApi.test.ts) | 更新 | 定型 | 承認の URL・本文、出力のファイル名と本文、失敗の `ApiError.code` |
| [`src/features/uml/__tests__/uml-editor-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-editor-store.test.ts) | 更新 | **コア** | 保存してから保存後の version で承認、検証エラーで検証パネルへ、409 で競合、出力後に取り直し |
| [`src/features/uml/components/__tests__/DiagramReviewActions.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/DiagramReviewActions.test.tsx) | 新規 | 定型 | 状態ごとのボタン、「保存して承認」、注意書き、未保存・生成中の無効化 |
| `src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx` | 更新 | 定型 | `DiagramReviewActions` をモックし、配置されることだけを見る |

## 要点の抜粋

```ts
// src/features/uml/uml-editor-store.ts(approve)
approve: async () => {
  const { projectId, diagram } = get();
  if (!projectId || !diagram) return;
  // 承認は DB に保存済みの版に対して行う。未保存の変更があれば先に保存する(検証と同じ順序)。
  if (get().dirty && !(await get().save())) return;
  set({ approving: true, error: null });
  try {
    const current = get().diagram ?? diagram;   // 保存した場合は version が変わっている
    set(fromServer(await approveDiagram(projectId, current.id, current.version)));
  } catch (err) {
    if (err instanceof ApiError && err.code === "VERSION_CONFLICT") set({ conflict: true });
    else if (err instanceof ApiError && err.code === "UML_APPROVAL_VALIDATION_FAILED") {
      set({ error: err.message });
      await get().validate();                     // 一覧は検証パネルに出す
    } else set({ error: messageOf(err, "承認に失敗しました") });
  } finally { set({ approving: false }); }
},
```

```ts
// src/features/uml/components/DiagramReviewActions.tsx(出し分け)
const APPROVABLE: DiagramStatus[] = ["draft", "reviewing"];   // BE の can_approve と同じ
const EXPORTABLE: DiagramStatus[] = ["approved", "exported"]; // BE の can_export と同じ
// 承認済みでも、未保存の変更があれば出力しない(出力されるのは保存済み=承認した版のため)
const exportable = EXPORTABLE.includes(diagram.status) && !dirty;
```

依存の向きは次のとおりである。

- `download.ts` は何にも依存しない。
- `umlApi.ts` → `client.ts`(`apiFetch`/`toApiError`)・`download.ts`(`parseFilename`)。
- ストア → `umlApi.ts`・`download.ts`(`saveFile`)。
- `DiagramReviewActions` → ストア・`labels.ts`。

## 設計判断

### 承認も「先に保存してから」

承認の API は、DB に保存済みの版を承認する。未保存の変更があるまま承認すると、画面に見えている図と承認される図がずれる。

Phase 11 の自動レイアウトと検証と同じく、`dirty` なら先に `save()` する。保存に成功すると version が1つ進むので、承認には `get().diagram` から取り直した version を送る。ボタンの文言は、`dirty` のとき「保存して承認」に変える。

### 承認できない理由は `code` で分ける

| code | 扱い |
|---|---|
| `VERSION_CONFLICT`(409) | 保存と同じく `conflict` にし、再読み込みを促す |
| `UML_APPROVAL_VALIDATION_FAILED`(400) | 件数のメッセージを出し、`validate()` で一覧を検証パネルに取る(12-1 でエラーに一覧を載せなかったため) |
| それ以外(`UML_LAYOUT_REQUIRED` など) | メッセージをそのまま出す |

### 出力の後に図を取り直す

出力に成功すると、サーバー側で状態が `exported` になる。出力の応答はファイルそのもので、図の JSON ではない。そのため、`getDiagram` で取り直して表示を合わせる。

出力は「承認済みで未保存の変更が無い」ときしか押せないので、取り直しても編集は失われない。

### 出力は生の fetch、失敗は `ApiError`

出力の応答は JSON ではないため、JSON 専用の `apiFetch` は使えない。文書のダウンロードと同じく、生の fetch で受け取る。

ただし、失敗は `toApiError` で `code` 付きの `ApiError` にする(`UML_DIAGRAM_NOT_APPROVED` などを見分けられるように)。文書のダウンロードは独自の `DownloadError` のまま変えなかった。駆動する消費者がいない遡及の整理はしない(#17 (b))。

### 共通化の範囲(#17)

`parseFilename` と `saveFile` は、文書のダウンロードと UML の出力という2つの実在する利用者がいるので、`download.ts` に移した。

「生の fetch で認証ヘッダーを付けて取る」部分(`downloadDocument` と `exportDiagram`)は、失敗の扱いが違う(`DownloadError` と `ApiError`)。そのため、共通化しなかった。

### M7・D6 の注意書きをいつ出すか

どちらも、承認済み・出力済みのときに出す。

- M7 の注意書きは、編集する**前**に知らせたいので、保存の後ではなく、承認済みの状態で常に出す。
- D6 の注意書きは、ダウンロードの操作の隣に置く([`docs/external_design.md`](../../docs/external_design.md) 2.6節「画面上に明示する」)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `parseFilename`・`saveFile` | Vitest | `URL.createObjectURL`/`revokeObjectURL` と `HTMLAnchorElement.click` をスタブにする。jsdom にはダウンロードの実体が無いため | `parseFilename` は純粋関数でスタブ不要 |
| `approveDiagram`・`exportDiagram` | Vitest | `fetch` のスタブ(承認は `stubFetch`、出力は本文が JSON でないので `vi.stubGlobal("fetch", ...)`) | 出力の失敗が `ApiError` になり、`code` を持つこと |
| ストアの `approve`・`exportDiagram` | Vitest | `fetch` のスタブ(`stubFetch`)。出力の応答だけ `mockResolvedValueOnce` で差し込む。`saveFile` は `vi.spyOn` で差し替える | 送ったリクエストの並び(PUT → POST approve)と、保存後の version を確かめる |
| `DiagramReviewActions` | Testing Library | ストアの `approve`/`exportDiagram` を `vi.fn()` に差し替える | 状態ごとの出し分けと配線だけを見る。無効化は Tamagui の `aria-disabled` で確かめる |
| `UmlDiagramPageContent` | Testing Library | `DiagramReviewActions` をモックする | 配置されることだけを見る |

ストアのテストで、出力の応答を `stubFetch` のキューに積まず `mockResolvedValueOnce` で差し込んだのは、`stubFetch` が本文を常に JSON にするためである。この方法では `stub.requests` にリクエストが記録されないので、URL は `fetchMock.mock.calls` から読む。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/lib/api src/features/uml src/features/documents
# Test Files 27 passed / Tests 142 passed
npx vitest run
# 全体: 333 件中 332 件成功。既存の IntakeForm.test.tsx の1件が並列実行の負荷でタイムアウトした
#       (単独で再実行すると成功。Phase 6-2 以来の既知の現象)。デモページの一覧の文言は Phase 12 に合わせて更新した
npx tsc --noEmit && npx eslint src
# 型エラーなし / 既存の警告1件(streamChat.test.ts)のみ
```

Docker が使えないため、ブラウザでの目視確認は未実施である。
