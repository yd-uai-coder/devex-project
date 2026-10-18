# Phase-78-1: 削除したプロジェクトの 404 の表示

## この章の目的

削除した(または無い)プロジェクトの URL をブックマークや履歴から開いたとき、チャット・文書・詳細設計の3画面に、API の英語の文(`Project {id} not found`)や空のチャットでなく、「このプロジェクトは見つかりません」とダッシュボードへのリンクを出す([外部設計書](../../docs/external_design.md) 2.12節「Phase 78 で確定」)。Phase 64 から申し送ってきた項目である。

自動実装モード: on([introduction](./Phase-78-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/api/client.ts`](../samples/frontend/src/lib/api/client.ts) | 更新 | `isNotFound(err)` |
| [`src/components/errors/ProjectNotFoundNotice.tsx`](../samples/frontend/src/components/errors/ProjectNotFoundNotice.tsx) | 新規 | 見つからない知らせ(見出し・理由・ダッシュボードへのリンク) |
| [`src/features/hearing/hearing-store.ts`](../samples/frontend/src/features/hearing/hearing-store.ts) | 更新 | `notFound`(`loadHistory` の 404) |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | `notFound`(`fetchDocuments` の 404) |
| [`src/features/detailed-design/detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | `notFound`(`fetchStages` の 404) |
| [`src/features/hearing/components/ChatPageContent.tsx`](../samples/frontend/src/features/hearing/components/ChatPageContent.tsx) | 更新 | `notFound` なら知らせだけを出す |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 同上 |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 同上 |
| [`src/lib/api/__tests__/client.test.ts`](../samples/frontend/src/lib/api/__tests__/client.test.ts) | 更新 | `isNotFound` |
| [`src/components/errors/__tests__/ProjectNotFoundNotice.test.tsx`](../samples/frontend/src/components/errors/__tests__/ProjectNotFoundNotice.test.tsx) | 新規 | 文とリンク先 |
| [`src/features/hearing/__tests__/hearing-store.test.ts`](../samples/frontend/src/features/hearing/__tests__/hearing-store.test.ts) | 更新 | 404 で立ち、500 では立たない |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 更新 | 同上 |
| [`src/features/detailed-design/__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 同上 |
| [`src/features/hearing/components/__tests__/ChatPageContent.test.tsx`](../samples/frontend/src/features/hearing/components/__tests__/ChatPageContent.test.tsx) | 更新 | 知らせの出し分け・別のプロジェクトの 404 を見ない |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 知らせを出し、本体を出さない |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 同上 |

## 1. 404 の見分けと知らせの部品

```ts
// src/lib/api/client.ts(抜粋)
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
```

```tsx
// src/components/errors/ProjectNotFoundNotice.tsx(抜粋)
<YStack paddingVertical="$4" gap="$3">
  <H2>このプロジェクトは見つかりません</H2>
  <Text color="$color11">削除された可能性があります。</Text>
  <Link href="/dashboard"><Text color="$blue10">ダッシュボードへ戻る →</Text></Link>
</YStack>
```

- **画面で読み替え、API の文は変えない**: API の 404 は、削除の印のある行も、無い ID も、他人のプロジェクトも同じ `RESOURCE_NOT_FOUND`(他人のプロジェクトがあることを漏らさないため)。画面からは区別できないので、「削除された可能性があります」と書く。
- **status だけで見る**: 3画面の最初の読み込み(履歴・文書の一覧・段階の一覧)は、どれもプロジェクトの下の一覧の取得で、404 になるのはプロジェクトが無いときだけ。code まで見る必要がない。
- **`role="alert"` を付けない**: 本体の代わりに出す画面の見出しで、何かの操作の失敗ではない。ページに Next.js の空の alert(ルートの読み上げ)があるので、E2E は見出しの文で取る。
- **共通の部品にした**: 3画面が同じ文とリンクを出す(#17。今この Phase に3つの消費者がある)。`NotFoundContent`(存在しない URL の 404 ページ)はメニューの一覧を出すもので、役割が違うので分けた。

## 2. ストアの `notFound`

```ts
// src/features/documents/documents-store.ts(抜粋)
set({ status: "loading", error: null, notFound: false });
try { ... } catch (err) {
  set({ status: "error", error: ..., notFound: isNotFound(err) });
}
```

- **3つのストアに同じ形で足す**: `hearing-store` の `loadHistory`、`documents-store` の `fetchDocuments`、`detailed-design-store` の `fetchStages`。読み込みを始めると下ろし、失敗が 404 なら立てる。500 などでは立てない(今までどおり `error` を出す)。
- **`status` の値を増やさなかった**: `AsyncStatus`(`idle`・`loading`・`success`・`error`)は共通の型で、ほかのストアも使う。「失敗の中の1つの理由」として別の真偽値にした。
- `documents-store` は `PROJECT_INITIAL` にも足した(別のプロジェクトを開くと下ろす)。

## 3. 画面の出し分け

```tsx
// src/features/hearing/components/ChatPageContent.tsx(抜粋)
// 前に開いた別のプロジェクトの404は見ない(ストアは画面をまたいで残る)
const notFound = useHearingStore((s) => s.notFound && s.projectId === projectId);
...
if (notFound) return <ProjectNotFoundNotice />;
```

- **フックの後で早期 return**: 読み込みの `useEffect` やポーリングのフックは今までどおり呼ぶ(フックの呼ぶ順を変えない)。本体(削除・再生成のボタン、段階、チャット)は出さない。
- **`projectId` が今の画面と同じときだけ見る**: ストアは画面をまたいで残る。削除したプロジェクト A を開いた後にプロジェクト B のチャットを開くと、ストアにはまだ A の `notFound` が残っている。チャットの履歴は `ChatPanel` が読み込むので、ここで知らせを出すと `ChatPanel` が出ず、B を読み込めなくなる。`projectId` で比べると、B では本体を出して読み込ませ、`loadHistory(B)` が `notFound` を下ろす。文書と詳細設計は画面自身が読み込むので詰まらないが、前のプロジェクトの知らせが一瞬出ないよう同じ形にした。
- **チャットは読み込みの後に切り替わる**: 初めは本体(`ChatPanel`)を出し、`loadHistory` が 404 で終わってから知らせに替わる。以前は 404 でも何も出さず、空のチャットに見えていた。

## テスト観点

用語: SUT(テストの対象)・ドライバ(SUT を呼ぶ側)・スタブ(SUT が呼ぶ相手の代わり)。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `client.test.ts`(更新) | `isNotFound` | 各テスト | スタブ不要 ── 純粋な関数で、外部の依存を呼ばないため |
| `ProjectNotFoundNotice.test.tsx`(新規) | `ProjectNotFoundNotice` | React Testing Library | スタブ不要 ── 表示だけで、外部の依存を呼ばないため |
| 3つのストアのテスト(更新) | `loadHistory`・`fetchDocuments`・`fetchStages` | 各テスト | `stubFetch`(404 と 500 を返す) |
| 3つの画面のテスト(更新) | 3つの `*PageContent` | React Testing Library | ストアの状態を直接入れる(取得の関数は `vi.fn()`)。チャットは `ChatPanel`・ポーリングを `vi.mock` |

- 見分け: 404 の `ApiError` だけが true / 500 の `ApiError`・ふつうの `Error` は false。
- 部品: 見出し・理由の文・`/dashboard` へのリンク。
- ストア: 404 で `status: "error"`(チャットは `historyStatus`)と `notFound: true` / 続けて 500 なら `notFound: false`(読み込みの始めに下ろす)。
- 画面: `notFound` なら見出しが出て、本体(「削除」・API の文・「ヒアリングチャット」の見出し)が出ない / 文書の画面は、知らせを出しても取得を呼ぶ / チャットは、ストアの `projectId` が違えば知らせを出さず本体を出す。
- 作成・更新したファイルは、この章のテストが import する。前方 import は無い。
