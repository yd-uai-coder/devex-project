# Phase-13-6: プレビューへの図の差し込み、陳腐化の表示、再反映・zip のボタン

## この章の目的

文書画面の内部設計のタブで、アンカーの位置に承認済みの図の SVG を表示する(D8)。あわせて、次のものを足す。

- 図と文書の食い違い(13-3)を、利用者が次にすることの言葉にして出す。
- 「図を再反映」「図付きでダウンロード(.zip)」のボタンと、D6 の注意書き。
- 設計図の一覧(`/uml`)に、「図の元になった内部設計書が古い」ことを示す表示。

学習モード([introduction](./Phase-13-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/documents/anchors.ts`](../samples/frontend/src/features/documents/anchors.ts) | 新規 | **コア** | `DocumentSegment`、`splitByAnchors`、`svgDataUri`(純粋) |
| [`src/features/documents/hooks/useDiagramEmbeds.ts`](../samples/frontend/src/features/documents/hooks/useDiagramEmbeds.ts) | 新規 | 定型 | 埋め込みの取得・再取得・エラー・取得済みか |
| [`src/features/documents/components/DiagramEmbed.tsx`](../samples/frontend/src/features/documents/components/DiagramEmbed.tsx) | 新規 | **コア** | `embedNotices`(食い違い → 言葉)、SVG を img の data URI で表示 |
| [`src/features/documents/components/DiagramSyncBar.tsx`](../samples/frontend/src/features/documents/components/DiagramSyncBar.tsx) | 新規 | 定型 | 反映されていない件数、再反映・zip のボタン、D6 の注意書き |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | **コア** | 内部設計書では `renderWithDiagrams` で分割して描く。再反映・zip の後に文書と埋め込みを取り直す |
| [`src/features/uml/uml-store.ts`](../samples/frontend/src/features/uml/uml-store.ts) | 更新 | 定型 | `isSourceOutdated`(純粋) |
| [`src/features/uml/uml-editor-store.ts`](../samples/frontend/src/features/uml/uml-editor-store.ts) | 更新 | 定型 | 承認に成功したら、文書一覧のキャッシュを捨てる |
| [`src/features/uml/components/DiagramList.tsx`](../samples/frontend/src/features/uml/components/DiagramList.tsx) | 更新 | 定型 | 「内部設計書が更新されています」の表示 |
| ── ここからテスト ── | | | |
| [`src/features/uml/test-utils/umlFixtures.ts`](../samples/frontend/src/features/uml/test-utils/umlFixtures.ts) | 更新 | 定型 | `makeEmbed` |
| [`src/features/documents/__tests__/anchors.test.ts`](../samples/frontend/src/features/documents/__tests__/anchors.test.ts) | 新規 | **コア** | 分割、連続した図、壊れたアンカー、繰り返し呼んでも同じ結果、data URI |
| [`src/features/documents/hooks/__tests__/useDiagramEmbeds.test.ts`](../samples/frontend/src/features/documents/hooks/__tests__/useDiagramEmbeds.test.ts) | 新規 | 定型 | enabled のときだけ取得、失敗の扱い |
| [`src/features/documents/components/__tests__/DiagramEmbed.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DiagramEmbed.test.tsx) | 新規 | **コア** | img の data URI、レビュー中の扱い、注意の出し分け |
| [`src/features/documents/components/__tests__/DiagramSyncBar.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DiagramSyncBar.test.tsx) | 新規 | 定型 | 件数・注意書き、再反映、zip を Blob で保存、失敗 |
| [`src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx) | 更新 | 定型 | 内部設計書では図と要素表を描く、それ以外では取得しない |
| [`src/features/uml/__tests__/uml-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-store.test.ts) | 更新 | 定型 | `isSourceOutdated` の表 |
| [`src/features/uml/__tests__/uml-editor-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-editor-store.test.ts) | 更新 | 定型 | 承認で文書一覧のキャッシュを捨てること |
| [`src/features/uml/components/__tests__/DiagramList.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/DiagramList.test.tsx) | 更新 | 定型 | 版が違う図にだけ表示が出ること |

## 要点の抜粋

```ts
// src/features/documents/anchors.ts
export type DocumentSegment =
  | { kind: "markdown"; text: string }
  | { kind: "diagram"; diagramId: string; version: number; body: string };

export function splitByAnchors(content: string): DocumentSegment[] {
  const start = new RegExp(START_SOURCE, "g");   // g の正規表現は lastIndex を持つので呼ぶたびに作る
  ...
}
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
```

```tsx
// src/features/documents/components/DocumentMarkdownView.tsx
function renderWithDiagrams(content: string, embeds: UmlEmbedRead[], loaded: boolean) {
  const byId = new Map(embeds.map((embed) => [embed.diagram_id, embed]));
  return splitByAnchors(content).map((segment, index) =>
    segment.kind === "markdown" ? (
      <ReactMarkdown key={index} ...>{segment.text}</ReactMarkdown>
    ) : (
      <DiagramEmbed key={index} embed={byId.get(segment.diagramId)} loaded={loaded}>
        <ReactMarkdown ...>{segment.body}</ReactMarkdown>
      </DiagramEmbed>
    ),
  );
}
```

```ts
// src/features/uml/uml-store.ts
export function isSourceOutdated(diagram: UmlDiagramRead, currentVersion: number | null): boolean {
  const source = diagram.source_doc_versions?.internal_design;
  return source != null && currentVersion != null && source !== currentVersion;
}
```

依存の向きは、`DocumentMarkdownView` → (`anchors.ts`・`DiagramEmbed`・`DiagramSyncBar`・`useDiagramEmbeds`) → `@/features/uml/api/umlApi` である。`uml-editor-store` は `documents-store` のキャッシュだけに触れる。

## 設計判断

### `rehype-raw` を入れず、描画の前に分割する

react-markdown は、`rehype-raw` を入れない限り生の HTML(コメントを含む)を描かない。アンカーはコメントなので、そのままでは「どこに図を差し込むか」が分からない。

`rehype-raw` を入れると、LLM が生成した文書の中の生の HTML も描かれるようになり、XSS の経路が開く(`MessageBubble.tsx` で避けている経路)。そのため、描画の前に本文を分割し、図のセグメントの位置に部品を置く形にした。アンカーは、バックエンドが見出しの直下に独立したブロックとして入れる(13-1)ので、分割しても表やリストが途中で切れない。

### SVG は img の data URI で表示する

`dangerouslySetInnerHTML` で SVG を DOM に入れると、SVG の中のスクリプトやイベント属性が動きうる。SVG はバックエンドの決定的なエンジンが書き出すもので、ラベルはエスケープ済みだが、表示の経路でも防いでおく。img で読み込んだ SVG はスクリプトを実行しない。data URI は `next/image` の最適化の対象外なので、素の img を使う(`/uml-demo` と同じ。lint の抑止に理由を添えた)。

### 食い違いを「次にすること」の言葉にする

`doc_state` と `source_outdated` をそのまま見せても、利用者は何をすればよいか分からない。`embedNotices` で、次のように言い換える。

| 状態 | 表示 |
|---|---|
| 承認済みで `outdated` | 「図を再反映」で最新にしてください |
| レビュー中で `outdated` | この要素表は前回承認した内容です(再承認すると反映されます) |
| `source_outdated` | 設計図を再生成して確認してください |
| 図が見つからない | 削除された可能性があります(取得が終わる前は出さない) |

`not_reflected`(承認済みなのに文書に無い)は、文書の中にアンカーが無いので、図の位置には出せない。`DiagramSyncBar` が件数として出し、「図を再反映」へ誘導する。

### 一覧の「図が古い」は、取得済みの生成候補と比べる

`GET /uml/embeds` は承認済みの図の SVG を含むので重い。一覧画面は既に `GET /uml/candidates` で `internal_design_version` を取得しているので、それと `source_doc_versions` を比べる。規則はバックエンドの `staleness.py` と同じ「等しくない」である(レイヤーの境界をまたぐため、式を両側に持つ。#17(c))。

### 承認したら文書一覧のキャッシュを捨てる

承認すると内部設計書の本文が変わる(13-2)。文書一覧のキャッシュ(20秒)が残っていると、承認の直後に文書画面を開いたとき、アンカーの無い古い本文が出る。一方、埋め込み API は「反映済み」と返すので、画面の表示が食い違う。承認の成功時に `fetchedAt` を null にして、次に開いたときに取り直させる。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `splitByAnchors`・`svgDataUri`・`isSourceOutdated`・`embedNotices` | Vitest | スタブ不要。文字列・値を受け取って返す純粋関数のため | 表示の規則をここで網羅する |
| `useDiagramEmbeds` | Vitest(`renderHook`) | `stubFetch`(`fetch` を差し替える) | enabled のときだけ取得すること |
| `DiagramEmbed` | Vitest + Testing Library | スタブ不要。props だけで描くため | img の `src` が data URI であること |
| `DiagramSyncBar`・`DocumentMarkdownView` | Vitest + Testing Library | `stubFetch`、zip は `fetchMock` を差し替え、`saveFile` はスパイ | ボタンから API を呼び、成功したら `onChanged` で取り直すこと |
| `uml-editor-store.approve`・`DiagramList` | Vitest | `stubFetch`、store の `setState` で状態を用意する | 文書一覧のキャッシュが捨てられること、版が違う図にだけ表示が出ること |

**表示の規則を純粋関数(`splitByAnchors`・`embedNotices`・`isSourceOutdated`)に出したので、部品のテストは「規則の結果が画面に出るか」を1〜2件見るだけで済んだ**。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/documents src/features/uml/__tests__ src/features/uml/components/__tests__/DiagramList.test.tsx
# 75 passed
npx tsc --noEmit
npm run lint
# 既存の警告1件(streamChat.test.ts)のみ
```
