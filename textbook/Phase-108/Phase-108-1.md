# Phase-108-1: ページと閲覧(状態・前回から変わった点・説明書)

## この章の目的

Phase 103 の公開の閲覧の API(`GET /api/v1/share/{token}`)を読む、ログインの要らないクライアント向けのページ `/share/<トークン>` を作る。題・リンクの状態・期限・判断の結果、前回から変わった点、説明書を1列で出し、リンクが無い・期限切れ・取り消しは理由だけを出す。外枠は、開発者向けのメニューとフッターを出さない素の枠にする(着手時の相談 (2))。

自動実装モード: on([introduction](./Phase-108-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/components/layout/client-page.ts`](../samples/frontend/src/components/layout/client-page.ts) | 新規 | `isClientPage`(パスが `/share/` で始まるか) |
| [`src/components/layout/Header.tsx`](../samples/frontend/src/components/layout/Header.tsx) | 更新 | `plain`(開閉ボタンの代わりに空き・題をリンクにしない) |
| [`src/components/layout/AppShell.tsx`](../samples/frontend/src/components/layout/AppShell.tsx) | 更新 | クライアントのページでメニュー・フッターを出さない |
| [`src/features/share/api/types.ts`](../samples/frontend/src/features/share/api/types.ts) | 新規 | `SharedChangeRequestRead` ほか(devex-api の `share_link.py` の形) |
| [`src/features/share/api/sharedApi.ts`](../samples/frontend/src/features/share/api/sharedApi.ts) | 新規 | `getSharedChangeRequest` |
| [`src/features/share/shareOps.ts`](../samples/frontend/src/features/share/shareOps.ts) | 新規 | 状態の知らせ・`isWritable`・失敗の文・`isLinkUnavailable`・日時の書式 |
| [`src/features/share/share-store.ts`](../samples/frontend/src/features/share/share-store.ts) | 新規 | `useShareStore`(`load`) |
| [`src/features/share/components/SharedStateNotice.tsx`](../samples/frontend/src/features/share/components/SharedStateNotice.tsx) | 新規 | 題・状態・期限・知らせ・判断の結果 |
| [`src/features/share/components/SectionChanges.tsx`](../samples/frontend/src/features/share/components/SectionChanges.tsx) | 新規 | 前回から変わった点 |
| [`src/features/share/components/SharedChangeRequestPageContent.tsx`](../samples/frontend/src/features/share/components/SharedChangeRequestPageContent.tsx) | 新規 | ページの本体 |
| [`src/app/share/[token]/page.tsx`](../samples/frontend/src/app/share/[token]/page.tsx) | 新規 | ページ(本体は `src/app/(pages)/share/[token]/page.tsx`)。`metadata` で検索に載せず参照元を送らない |
| [`src/features/share/test-utils/sharedFixtures.ts`](../samples/frontend/src/features/share/test-utils/sharedFixtures.ts) | 新規 | `makeShared`・`makeHiddenShared`・`FINGERPRINT` |
| [`src/features/share/test-utils/renderShare.tsx`](../samples/frontend/src/features/share/test-utils/renderShare.tsx) | 新規 | `seedShareStore`・`renderWithTamagui` |
| [`src/features/share/__tests__/shareOps.test.ts`](../samples/frontend/src/features/share/__tests__/shareOps.test.ts) | 新規 | 純粋関数 |
| [`src/features/share/__tests__/share-store.test.ts`](../samples/frontend/src/features/share/__tests__/share-store.test.ts) | 新規 | 読み込み |
| [`src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx`](../samples/frontend/src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx) | 新規 | 状態ごとの出し分け |
| [`src/app/share/[token]/__tests__/page.test.tsx`](../samples/frontend/src/app/share/[token]/__tests__/page.test.tsx) | 新規 | トークンを渡す・`metadata` |
| [`src/components/layout/__tests__/AppShell.test.tsx`](../samples/frontend/src/components/layout/__tests__/AppShell.test.tsx) | 新規 | 外枠の出し分け |

## 1. 見た目

```
┌──────────────── Devex(リンクなし) ─────────── [☀] ┐   ← メニュー・開閉ボタン・フッターなし
CR-2 予約の上限の変更  [開いている]
このリンクの期限: 2026/11/8 まで
説明書を読んで、合意か却下かをお知らせください。…
[読み直す]
┌ 前回(10/20 …)から変わった点 ┐       ← 変わった点があるときだけ(108-1)
│ 選択肢  − …  + …             │
└──────────────────────────────┘
# 変更の説明書 CR-2 …(出力の md)
                                         ← お名前(108-2)・ご判断(108-3)・コメント(108-2)
```

- **外枠**: `AppShell` が `usePathname()` を `isClientPage` に渡し、真ならメニューとフッターを描かず、`Header` に `plain` を渡す。`Header` は開閉ボタンの代わりに同じ大きさの空き(`Square size="$3"`)を置き、題をリンクにしない(題が中央からずれないように)。テーマの切り替えは残す。
- **ページ**: `RequireAuth` で包まない。`metadata` に `robots: { index: false, follow: false }` と `referrer: "no-referrer"` を置く。URL のトークンは読む権限そのもので、検索エンジンや外へのリンクの Referer に載ると、誰でも読めてしまうため。ほかの動的ページと同じく、`params` の解決だけを Server Component で行い、Tamagui を使う本体は Client Component に任せる(devex-ui の `CLAUDE.md` のハマりどころ)。
- **状態**: 開いている・判断済みは説明書を出す。直している・閉じたは API が説明書を返さないので、知らせだけになる。判断済みなら、判断の結果(合意 / 却下・日時・選んだ案・判断した人・出どころ)を枠で出す。状態の色は開発者の共有タブと同じ `SHARE_STATE_TONE`(changeRequestOps)を使う(同じ事実を2か所に持たない。#17)。
- **リンクが使えない**: 404(無い。簡易ドキュメントモードの CR も API が 404 を返す)・410(期限切れ・取り消し)は、題「変更のご相談」と理由の文だけを出し、読み直しのボタンも出さない(読み直しても変わらない)。期限切れは「延長を頼んでください」、取り消しは「今のリンクを確かめてください」と、次にすることを分けて書く(Phase 103 の決定)。429 は読んだ中身を残して知らせる。
- **読み直し**: 手で押すだけ。自動では読み直さない(公開の入口は IP ごとに1時間60回までのため)。
- **前回から変わった点**: API の `changes`(節の名前・消えた行・足した行)と `changed_since` を、黄色の枠で説明書の前に出す。変わった点が無ければ描かない。

## 2. 型・API・純粋関数・ストア

```ts
// src/features/share/api/types.ts(抜粋)
export type SharedChangeRequestRead = {
  state: ShareState; state_label: string; label: string; title: string; expires_at: string;
  markdown: string | null; fingerprint: string | null;           // 開いている・判断済みのときだけ
  options: SharedOptionRead[]; recommended_reason: string;
  changes: SectionChangeRead[]; changed_since: string | null;
  decision: SharedDecisionRead | null; comments: SharedCommentRead[];
};

// src/features/share/shareOps.ts(抜粋)
export function stateNotice(state: ShareState): string
export function isWritable(shared: SharedChangeRequestRead): boolean   // 開いていて指紋がある
export function shareFailureMessage(err: unknown, fallback: string): string
export function isLinkUnavailable(err: unknown): boolean              // 404・410

// src/features/share/share-store.ts(抜粋)
token: string | null; shared: SharedChangeRequestRead | null; status; error; unavailable: boolean;
load: (token: string) => Promise<void>;
```

- `ShareState` は開発者の側の型(`features/change-requests/api/types.ts`)を使う。同じ API の値なので型を2つにしない。
- 失敗の文は `ApiError` の `status` と `code` で決める。devex-api の 404 の `detail` は英語("Share link not found")なので、そのまま出さない。
- ストアは開発者の CR のストアと分けた(ログインの要らないページで、プロジェクトの文脈を持たないため)。別のトークンを開くと前の中身を捨てる。応答が届く前に別のトークンに移ったら、届いた応答を捨てる。

## テスト観点

この Phase の用語(SUT = テストする対象、ドライバ = 対象を動かす側、スタブ = 対象が呼ぶ相手の代わり)は、これまでの Phase と同じ。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `shareOps.test.ts` | 状態の知らせ・`isWritable`・失敗の文・`isLinkUnavailable` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まるため |
| `share-store.test.ts` | `load` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 呼ぶ URL と、失敗の後の状態を見るため |
| `SharedChangeRequestPageContent.test.tsx` | ページの本体(`SharedStateNotice`・`SectionChanges` を通る) | Testing Library | ストアの `load`(`seedShareStore`)── 出し分けだけを見るため |
| `page.test.tsx` | `page.tsx` | 非同期の Server Component を呼んで描く | 本体の部品を `vi.mock` ── トークンを渡すことと `metadata` だけを見るため |
| `AppShell.test.tsx` | `AppShell`(`isClientPage`・`Header` の `plain` を通る) | Testing Library | `usePathname`・`@tamagui/next-theme`(jsdom で解決できない)|

- 統合スモーク: 開いているリンクで題・状態・期限・説明書が出る。
- 直しているときは説明書を出さない。判断済みは判断の結果を出す。変わった点を節ごとに出す。
- 期限切れは理由だけ(読み直しのボタンなし)。開くとトークンで読み、読み直しで読み直す。
- ストア: 期限切れで中身を捨てる。429 は中身を残す。別のトークンで前の中身を捨てる。
- 外枠: 開発者のページはメニュー・トップへのリンク・フッターを出し、`/share/…` は出さない。`/share`(トークン無し)はクライアントのページとみなさない。
