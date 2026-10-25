# Phase-107-4: 共有リンクの管理と共有タブ

## この章の目的

Phase 103 の共有リンク(CR ごとに1本。トークンはハッシュで保存し、URL は作ったときに1度だけ返る。期限 1〜90日・延長・取り消し)を、CR の詳細の新しい「共有」タブから作り・管理できるようにする(着手時の相談 (2))。作ると下書きは説明済みになり、前のリンクは使えなくなることを、作る前の確かめで伝える。確認済みの要約が古いまま(Phase 101 の `needs_reconfirm`)なら、そのことも知らせるが、作るのは止めない(相談 (4))。説明書のタブの要約の欄にも、同じ知らせを出す。

自動実装モード: on([introduction](./Phase-107-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ShareState`・`ShareLinkRead`・`ShareLinkCreatedRead`。要約に `needs_reconfirm` |
| [`src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | `createShareLink`・`listShareLinks`・`revokeShareLink`・`extendShareLink` |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | 期限の日数・状態の色・`canShare`・`shareUrl`・`shareDaysProblem`・`activeShareLink` |
| [`src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | ビュー `shareLinks`、`createdLink`・`shareActing`・`shareError`、`createShare`・`revokeShare`・`extendShare`・`dismissCreatedLink` |
| [`src/features/change-requests/components/ShareLinkPanel.tsx`](../samples/frontend/src/features/change-requests/components/ShareLinkPanel.tsx) | 新規 | リンクの作成・URL の表示とコピー・一覧・延長・取り消し |
| [`src/features/change-requests/components/ShareTab.tsx`](../samples/frontend/src/features/change-requests/components/ShareTab.tsx) | 新規 | 共有タブ |
| [`src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | 6つ目のタブ「共有」 |
| [`src/features/change-requests/components/ExplanationTab.tsx`](../samples/frontend/src/features/change-requests/components/ExplanationTab.tsx) | 更新 | 古い要約の知らせ |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeShareLink`・`makeCreatedShareLink`。要約の既定に `needs_reconfirm` |
| [`src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | 共有リンクのビュー・状態・操作 |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | 共有リンクの純粋関数 |
| [`src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | 作る・取り消す・延ばす |
| [`src/features/change-requests/components/__tests__/ShareLinkPanel.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ShareLinkPanel.test.tsx) | 新規 | 共有タブとリンクの枠 |
| [`src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 更新 | タブの並び |
| [`src/features/change-requests/components/__tests__/ExplanationTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ExplanationTab.test.tsx) | 更新 | 古い要約の知らせ |

## 1. 見た目

```
内容  影響  検証  説明書  [共有]  たどる記録
共有リンク
 クライアントは、このリンクからログインせずに説明書・選択肢・規模を読み、…
 ┌ リンクを作りました。この URL は今だけ表示します(画面を移ると見られません)。…
 │ https://devex.uandi-tech.com/share/Hk3w…
 └ [URL をコピー] コピーしました [閉じる]
 期限(日。1〜90。作る・延ばすで使う) [14]  [リンクを作り直す]
 作った日時 | 状態       | 期限 | 最後に見られた | 操作
 10/24 …    | 開いている | 11/7 | 10/25 09:12    | [期限を延ばす][取り消す]
 10/20 …    | 取り消し   | 11/3 | ―              |
 CR を直すと下書きに戻り、リンクは「直しています」になります(取り消しにはなりません)。…
コメント              ← 107-5
```

- 共有リンクとコメントは、どちらもクライアントとのやりとりなので、1つのタブにまとめた(相談 (2))。
- URL はトークンを含み、devex-api はこの応答でしか返さない(保存はハッシュだけ)。ストアの `createdLink` に CR の番号と一緒に持ち、その CR の共有タブでだけ出す。別の CR を開くと捨てる。リロードでも消える(メモリだけ)ので、画面に「今だけ表示します」と書いた。なくしたら作り直す(Phase 103 の決定)。
- URL は応答の `path`(`/share/<トークン>`)に `window.location.origin` を付けて作る(`shareUrl`)。クライアントの画面(Phase 108)は devex-ui に置くので、今開いている Devex の origin がそのまま使える。
- 作る・作り直す・延ばす・取り消すは、すべて確かめのダイアログを挟む。作るときの文は、下書きなら「説明済みになります」、有効なリンクがあれば「今のリンクは使えなくなります」、要約が古ければその知らせ(作るのは止めない)。
- 期限の日数の欄は、作ると延ばすの両方で使う(延ばすは「今から n日後」に置き直す。Phase 103 の決定)。作れない状態(合意の後など)でも、延ばせるように欄は出す。
- 状態の色: 開いている = 緑、直しています = 黄、判断済み = 青、閉じた = 灰、期限切れ・取り消し = 赤。取り消したリンクには操作を出さない(延ばせない。Phase 103)。

## 2. 純粋関数とストア

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export const SHARE_DEFAULT_DAYS = 14;
export const SHARE_MAX_DAYS = 90;
export function canShare(status: ChangeRequestStatus): boolean           // 下書き・説明済み
export function shareUrl(path: string, origin: string): string
export function shareDaysProblem(value: string): string | null           // 1〜90 の整数
export function activeShareLink(links: ShareLinkRead[]): ShareLinkRead | null

// src/features/change-requests/change-requests-store.ts(抜粋)
createdLink: { number: number; link: ShareLinkCreatedRead } | null;
createShare: (projectId, number, expiresInDays) => Promise<boolean>;
revokeShare / extendShare: (…) => Promise<boolean>;                    // 応答で一覧の同じ行を置き換える
```

- `createShare`: 作った応答を `createdLink` に入れ、CR を読み直して詳細を置き換える(下書きなら説明済みになり、許される操作も変わる)。置き換えでタブの内容を捨てるので、共有リンクの一覧も読み直す(前のリンクが「取り消し」になったのが見える)。
- `revokeShare`・`extendShare` は CR を変えないので、応答のリンクで一覧の同じ行だけを置き換える。
- 共有リンクの操作の実行中と失敗は `shareActing`・`shareError`(CR の状態の操作の `acting` と分ける)。

## 3. 古い要約の知らせ

- 説明書のタブ: 要約の `needs_reconfirm`(確認済みのまま、その後の説明書の変化で古くなった)が真なら、「共有する前に確かめ直してください」を出す。古い要約は出力にもクライアントの画面にも載らないので、クライアントに古い文が出ることは無い。知らせは、開発者が要約を載せたつもりでいるのを防ぐため。
- 共有タブ: 作る前の確かめで同じことを知らせる。共有タブは要約の状態を知るために説明書のビューを読む(内容タブ・説明書タブと共有)。作った応答の `summary_needs_reconfirm` も、URL の枠に出す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts`「共有リンク」 | `canShare`・`shareUrl`・`shareDaysProblem`・`activeShareLink` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まるため |
| `change-requests-store.test.ts` | `createShare`・`revokeShare`・`extendShare` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 本文・URL と、詳細・一覧の置き換えを見るため |
| `ShareLinkPanel.test.tsx`(新規) | `ShareTab`・`ShareLinkPanel` | Testing Library | ストアの関数(`vi.fn`)と `navigator.clipboard` ── 確かめの文と、操作に渡す値を見るため |
| `ChangeRequestDetailContent.test.tsx` | `ChangeRequestDetailContent` | Testing Library | タブの部品を `vi.mock` ── タブの並びと切り替えだけを見るため |
| `ExplanationTab.test.tsx` | `ExplanationTab` | Testing Library | ストアの関数(`vi.fn`)|

- 統合スモーク: 共有タブを開くと、リンクの一覧と説明書を読む。
- 下書きの CR で作ると「説明済みになります」と古い要約の知らせを出し、入れた日数で作る。
- 有効なリンクがあれば「作り直す」で、前のリンクが使えなくなると確かめる。日数が範囲の外なら押せない。
- 作った直後だけ URL(今の origin + path)を出してコピーでき、閉じると消す。別の CR で作った URL は出さない。
- 一覧に状態・期限・最後に見られた日時を出し、取り消していないリンクだけを延ばす・取り消す。
- ストア: 作るとトークンつきのリンクを持ち、CR を読み直す。別の CR を開くと捨てる。取り消し・延長は一覧の行を置き換え、失敗は `shareError`。
- 説明書タブ: 確認済みのまま古くなった要約で知らせを出す。
- タブは「内容・影響・検証・説明書・共有・たどる記録」の6つ。
