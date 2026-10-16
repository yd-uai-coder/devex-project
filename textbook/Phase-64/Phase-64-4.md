# Phase-64-4: 画面への配置

## この章の目的

[64-3](./Phase-64-3.md) の `DeleteProjectButton` を3か所に置く。

- ダッシュボードのカード: 進行状態の右に、ゴミ箱のアイコンだけを置く。
- 文書の画面(SCR-005)と詳細設計の画面(SCR-008): 操作の並びの右端に、文字の「削除」を置く。削除したらダッシュボードへ戻る。

ダッシュボードのカードは全体が `<Link>` になっていたので、リンクとボタンを兄弟に組み直す。

自動実装モード: on([introduction](./Phase-64-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | `projectTitle`(`fetchProjectMode` で一緒に持つ) |
| [`src/features/dashboard/components/ProjectListItem.tsx`](../samples/frontend/src/features/dashboard/components/ProjectListItem.tsx) | 更新 | カードの中でリンクとボタンを兄弟にする |
| [`src/features/documents/components/DocumentsPageContent.tsx`](../samples/frontend/src/features/documents/components/DocumentsPageContent.tsx) | 更新 | 並びの右端に「削除」 |
| [`src/features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 「← ドキュメントに戻る」の右に「削除」 |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 更新 | 名前を持つ・失敗で null |
| [`src/features/dashboard/components/__tests__/ProjectList.test.tsx`](../samples/frontend/src/features/dashboard/components/__tests__/ProjectList.test.tsx) | 更新 | ボタンはリンクの外・確認してからカードを外す |
| [`src/features/documents/components/__tests__/DocumentsPageContent.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentsPageContent.test.tsx) | 更新 | 確認して削除 → `/dashboard`(生成中でも押せる) |
| [`src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 確認して削除 → `/dashboard`(文言は「このプロジェクト」) |

## 1. 文書の画面のストアに名前を持たせる(`documents-store.ts`)

- `fetchProjectMode` はもともと `getProject` を呼び、モードだけを持っていた。名前(`projectTitle`)も一緒に持たせる。失敗したときと、別のプロジェクトを開いたとき(`PROJECT_INITIAL`)は null にする。
- 新しく API を呼ばずに、確認の本文とトーストに名前を出せる。

## 2. カードの組み直し(`ProjectListItem.tsx`)

```tsx
// src/features/dashboard/components/ProjectListItem.tsx
<StyledCard hoverStyle={{ borderColor: "$color8" }}>
  <XStack justifyContent="space-between" alignItems="center" gap="$3">
    <Link href={projectHref(project)} aria-label={...} style={{ flex: 1, minWidth: 0 }}>
      {/* モードのバッジと題名 */}
    </Link>
    <XStack alignItems="center" gap="$2" flexShrink={0}>
      <Text>{STATUS_LABEL[project.status]}</Text>
      <DeleteProjectButton projectId={project.id} title={project.title} variant="icon" />
    </XStack>
  </XStack>
</StyledCard>
```

- `<a>` の中に `<button>` は置けない(押すと遷移もする)。リンクを残りの幅いっぱいにする(`flex: 1`)ので、カードの大部分を押せば今までどおり開く。
- リンクの `aria-label`(「{題名}({進行状態})」)と `href` は変えない。既存のテストと E2E の前提を壊さない。
- 進行状態は、リンクの外に出した。

## 3. 2つの画面(`DocumentsPageContent.tsx`・`DetailedDesignPageContent.tsx`)

- 文書の画面: 並び(「チャットに戻る」「詳細設計へ進む →」/「実装手順書へ進む →」「再生成する」)の最後に置く。**再生成中でも押せる**(生成中でも削除できる。「再生成する」は押せなくなる)。
- 詳細設計の画面: 「← ドキュメントに戻る」のリンクだけだったので、内側の `XStack` で包み、その右に置く。この画面はプロジェクトの名前を読み込まないので、`title` を渡さない(文言は「このプロジェクト」)。名前のためだけに `getProject` を足すと、既存のテストが使う fetch のスタブの順番も変わるので、足さなかった。
- どちらも `onDeleted={() => router.push("/dashboard")}`。削除の後に画面に残ると、生成の進み具合のポーリングが404を受け続ける。すぐ離れれば、ポーリングの部品はアンマウントされて止まる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `documents-store.test.ts`(更新) | `fetchProjectMode` | ストアの関数を直接呼ぶ | `fetch`(`stubFetch`) |
| `ProjectList.test.tsx`(更新) | `ProjectList` → `ProjectListItem` → `DeleteProjectButton` | ユーザーの操作 | `fetch`(`stubFetch`)と `useToastController`(`vi.mock`) |
| `DocumentsPageContent.test.tsx`(更新) | `DocumentsPageContent` の並び | ユーザーの操作 | 既存のスタブ(ポーリング・タブ・レビューのパネル・ストアの関数)に、`next/navigation` の `useRouter`・`useToastController`・`fetch` を足す |
| `DetailedDesignPageContent.test.tsx`(更新) | `DetailedDesignPageContent` の見出しの並び | ユーザーの操作 | 同上(`next/navigation`・`useToastController`・`fetch`) |

- 3か所とも、押すと確認のダイアログが開き、「削除する」を押すまで削除の API を呼ばない(確認を削除の処理に共通にした、ユーザーの指定の番人)。
- カード: ボタンはリンクの中に無い(`not.toContainElement`)。削除するとカードが消え、呼んだのは一覧の GET と DELETE の2回だけになる。
- 文書の画面: 再生成中の状態で「削除」を押せる。本文に名前が出る。削除すると `router.push("/dashboard")`。
- 詳細設計の画面: 本文は「このプロジェクトと、…」。削除すると `router.push("/dashboard")`。
- 2つの画面のテストは `useRouter` を使うようになったので、`next/navigation` のモックを足した(それまでは使っていなかった)。
- 作成・更新したファイルは、この章のテストがすべて import する。前方 import は無い(`DocumentsPageContent.tsx` が読む `projectTitle` は、表の上の `documents-store.ts` で足す)。
