# Phase-108-2: 名前とコメント

## この章の目的

Phase 104 のコメントの API(`POST /api/v1/share/{token}/comments`)を、クライアントのページから使えるようにする。名前の欄はページに1つで、コメントと合意 / 却下(108-3)の両方で使い、そのブラウザに覚える(着手時の相談 (4))。開いた後に開発者が説明書を直していたら、書いた内容を残したまま読み直しを促す。

自動実装モード: on([introduction](./Phase-108-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/share/api/types.ts`](../samples/frontend/src/features/share/api/types.ts) | 更新 | `SharedCommentCreate` |
| [`src/features/share/api/sharedApi.ts`](../samples/frontend/src/features/share/api/sharedApi.ts) | 更新 | `postSharedComment` |
| [`src/features/share/shareOps.ts`](../samples/frontend/src/features/share/shareOps.ts) | 更新 | `CLIENT_NAME_MAX`・`loadClientName`・`saveClientName`・`nameProblem`・`isExplanationChanged` |
| [`src/features/share/share-store.ts`](../samples/frontend/src/features/share/share-store.ts) | 更新 | `name`・`restoreName`・`setName`・`explanationChanged`・`commenting`・`commentError`・`comment` |
| [`src/features/share/components/ClientNameField.tsx`](../samples/frontend/src/features/share/components/ClientNameField.tsx) | 新規 | お名前の欄 |
| [`src/features/share/components/SharedComments.tsx`](../samples/frontend/src/features/share/components/SharedComments.tsx) | 新規 | コメントと返信・書く欄 |
| [`src/features/share/components/SharedChangeRequestPageContent.tsx`](../samples/frontend/src/features/share/components/SharedChangeRequestPageContent.tsx) | 更新 | 名前の復元・読み直しの促し・お名前・コメント |
| [`src/features/share/test-utils/renderShare.tsx`](../samples/frontend/src/features/share/test-utils/renderShare.tsx) | 更新 | 名前・コメントの状態 |
| [`src/features/share/__tests__/shareOps.test.ts`](../samples/frontend/src/features/share/__tests__/shareOps.test.ts) | 更新 | 名前の覚え・確かめ |
| [`src/features/share/__tests__/share-store.test.ts`](../samples/frontend/src/features/share/__tests__/share-store.test.ts) | 更新 | 名前・コメント・説明書の変化 |
| [`src/features/share/components/__tests__/SharedComments.test.tsx`](../samples/frontend/src/features/share/components/__tests__/SharedComments.test.tsx) | 新規 | 一覧・書く欄 |
| [`src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx`](../samples/frontend/src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx) | 更新 | お名前の欄・読み直しの促し |

## 1. 見た目

```
# 変更の説明書 …
┌ 説明書が新しくなりました。読み直してから、もう一度送ってください(書いた内容は残ります)。┐  ← 409 のときだけ
└ [説明書を読み直す]                                                                      ┘
お名前(コメントとご判断に記録されます)
[山田        ]
このブラウザに覚えておきます。
                                         ← ご判断(108-3)
コメント
│ 山田 ・2026/10/24 9:00
│ 期間は何日まで?
    │ 開発者 ・2026/10/24 11:00
    │ 90日までです
[分からない点・気になる点を書いてください]
[コメントを送る]
```

- **名前**: ストアの `name` に持ち、`setName` で `localStorage` にも書く(空にすると消す)。読み出しは描いた後の effect の `restoreName` で行う(サーバーの描画とずらさないため)。`localStorage` の読み書きは try/catch で包み、プライベートウィンドウなどで覚えられなくても、ページの中では使える。覚えるのは名前だけ(このブラウザでの便利のため。トークンや本文は覚えない)。
- **名前の欄の置き場**: 説明書の後、ご判断の前に1つ。開いているリンクだけ出す(判断済み・直しているときは書けないので出さない)。
- **コメント**: クライアントのコメントごとに開発者の返信をまとめて古い順に出す(API がその形で返す)。返信の書き手は API が「開発者」として返す。書く欄は開いているリンクだけ。名前が無ければ送らずに知らせる。送れたら欄を空にし、応答のコメントを一覧の末尾に足す(読み直さない)。
- **説明書の変化**: 409 `SHARE_EXPLANATION_CHANGED` が返ったら、ストアの `explanationChanged` を立て、説明書の後に読み直しの枠を出す。書いた本文は欄の部品の状態に残る(読み直しでも同じトークンなら中身を置き換えるだけで、部品は作り直さない)。読み直すと `explanationChanged` と `commentError` を下ろす。

## 2. 純粋関数とストア

```ts
// src/features/share/shareOps.ts(抜粋)
export const CLIENT_NAME_MAX = 200;                 // devex-api の COUNTERPART_MAX
export function loadClientName(): string            // 覚えられなければ ""
export function saveClientName(name: string): void  // 空白だけなら忘れる
export function nameProblem(name: string): string | null
export function isExplanationChanged(err: unknown): boolean

// src/features/share/share-store.ts(抜粋)
name: string; restoreName(); setName(name);
explanationChanged: boolean; commenting: boolean; commentError: string | null;
comment: (body: string) => Promise<boolean>;        // { name(trim), body, fingerprint } を送る
```

- 本文の上限は、開発者の返信と同じ `COMMENT_BODY_MAX`(changeRequestOps)を使う(devex-api ではコメントと返信が同じ上限)。
- `comment` は見た説明書の `fingerprint` を添える。指紋が無い(直している・閉じた)ときは送らない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `shareOps.test.ts`「名前」 | `loadClientName`・`saveClientName`・`nameProblem`・`isExplanationChanged` | vitest のテスト関数 | 覚えられないブラウザは `Storage.prototype` を `vi.spyOn` で投げさせる(ほかはスタブ不要 ── 純粋なため)|
| `share-store.test.ts` | `setName`・`restoreName`・`comment` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 本文と、409 の後の状態を見るため |
| `SharedComments.test.tsx`(新規) | `SharedComments` | Testing Library | ストアの `comment`(`seedShareStore`)── 欄の振る舞いだけを見るため |
| `SharedChangeRequestPageContent.test.tsx` | ページの本体(`ClientNameField` を通る) | Testing Library | ストアの `load` |

- 統合スモーク: コメントと開発者の返信が出る。
- 覚えた名前を読み、空にすると忘れる。覚えられないブラウザでも投げない。名前は空白だけ・上限超えで送れない。
- コメントは名前(前後の空白を除く)・本文・見た指紋を送り、一覧に足す。
- 409 の説明書の変化では送れず、`explanationChanged` を立てる。読み直すと下ろす。
- 書く欄は開いているリンクだけ。名前が無いと送らない。送れたら本文を消し、送れなければ残す。
- お名前の欄は開いているリンクだけ。読み直しの枠のボタンで読み直す。
