# Phase-107-5: コメントと返信・たどる記録の新しい行

## この章の目的

Phase 104 のコメント欄(クライアントが共有リンクから名前を書いてコメントし、開発者がそのコメントに1段だけ返信する)を、共有タブの「コメント」に出し、返信できるようにする。今より前の版の説明書を見て書かれたコメントには、その旨を添える(コメントは書いたときの説明書の指紋を持つ)。あわせて、Phase 103・104 で時系列に増えた行(共有リンクの作成・取り消し・延長、コメント、返信)を、たどる記録の型に足す。

自動実装モード: on([introduction](./Phase-107-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ChangeRequestCommentRead`。`ChangeRequestAction` に `share`・`unshare`・`extend_share`・`comment`・`reply_comment` |
| [`src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | `listComments`・`replyComment` |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `COMMENT_BODY_MAX`・`commentAuthor`・`commentedOnOlderVersion` |
| [`src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | ビュー `comments`、`replying`・`replyError`、`reply` |
| [`src/features/change-requests/components/CommentThread.tsx`](../samples/frontend/src/features/change-requests/components/CommentThread.tsx) | 新規 | コメント欄と返信の欄 |
| [`src/features/change-requests/components/ShareTab.tsx`](../samples/frontend/src/features/change-requests/components/ShareTab.tsx) | 更新 | 「コメント」の節 |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeComment` |
| [`src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | コメントのビュー・状態・`reply` |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | コメントの純粋関数 |
| [`src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | 返信 |
| [`src/features/change-requests/components/__tests__/CommentThread.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/CommentThread.test.tsx) | 新規 | コメント欄 |

## 1. 見た目

```
コメント
│ 佐藤(クライアント) ・2026/10/24 15:02 ・前の版の説明書を見て書かれました
│ 矢印は3種類で足りますか
    │ 開発者(返信) ・2026/10/24 17:40
    │ 3種類で考えています
    [                         ] [返信する]
```

- 開発者から新しいコメントは書けず、返信への返信も無い(Phase 104 の決定)。返信の欄は `can_reply` のコメント(クライアントのコメント)だけに出す。
- 「前の版の説明書を見て書かれました」は、コメントの `fingerprint` が今の説明書の `fingerprint` と違うときに出す(`commentedOnOlderVersion`)。CR を直して説明し直した後に、前のコメントが今の説明書に当てはまるとは限らないため。説明書を読んでいなければ出さない。
- 返信の本文は devex-api と同じく2000字まで(欄の `maxLength`)。空白だけなら送れない。
- コメントの削除・編集は作っていない(申し送りどおり、Phase 110 の画面確認で要るかを決める)。

## 2. ストア

- `reply(projectId, number, commentId, body)`: 返信の応答(返したコメントと、その返信の一覧)で、一覧の同じコメントを置き換える。返信は時系列に1行(`reply_comment`)残るので、たどる記録のビューを捨てて、開いたときに読み直させる。
- 返信の送信中は `replying` にコメントの ID を持ち、そのコメントのボタンを「送信中...」にして、ほかの返信も止める。

## 3. たどる記録の新しい行

- `ChangeRequestAction` に `share`・`unshare`・`extend_share`・`comment`・`reply_comment` を足した。たどる記録のタブは、行の名前をサーバーの `action_label`(「共有リンクを作った」など)で出しているので、表示は変わらない。型を API に合わせ、行の種類で出し分けるときに型で漏れを見つけられるようにするため。
- 共有リンクからの合意・却下の行の「出どころ」は、Phase 104 で `note` に入っているので、今のタブのまま出る。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts`「コメント」 | `commentAuthor`・`commentedOnOlderVersion` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まるため |
| `change-requests-store.test.ts` | `fetchView("comments")`・`reply` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 返信の URL・本文と、一覧の置き換え・記録のビューを捨てることを見るため |
| `CommentThread.test.tsx`(新規) | `CommentThread`(`ShareTab` の中の節) | Testing Library | ストアの関数(`vi.fn`)── 読み込みと、返信に渡す値・欄の出し分けを見るため |

- 統合スモーク: 開くとコメント欄を読み、無ければ「まだコメントはありません」。
- コメントごとに返信をまとめ、前の版を見たコメントに印を付ける。返信は前後の空白を除いて送る。
- 返信できないコメントには欄を出さない。返信の失敗を出す。
- ストア: 返信は返ったコメントで一覧の同じコメントを置き換え、記録のビューを捨てる。
- `ShareTab` は 107-4 の `ShareLinkPanel.test.tsx` が描くので、コメントの節も通る(`CommentThread` は `vi.fn` の読み込みで「読み込み中...」)。
