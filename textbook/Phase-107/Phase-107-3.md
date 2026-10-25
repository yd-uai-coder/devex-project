# Phase-107-3: 選択肢の LLM の下書き

## この章の目的

Phase 102 の選択肢の LLM の下書き(説明書の md から2〜3の案とおすすめを作る。未確認ででき、説明書に載らない)を、選択肢の節から作り・確かめ・取り込めるようにする。取り込めない問題(案の規則・CR の対象に無い要件)があれば取り込みを止め、説明書に無い要件 ID・数字は知らせるだけにする(要約の照合と同じ扱い)。

自動実装モード: on([introduction](./Phase-107-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `OptionDraftStatus`・`OptionDraftRead` |
| [`src/features/change-requests/api/changeRequestsApi.ts`](../samples/frontend/src/features/change-requests/api/changeRequestsApi.ts) | 更新 | `createOptionDraft`・`getOptionDraft`・`adoptOptionDraft` |
| [`src/features/change-requests/change-requests-store.ts`](../samples/frontend/src/features/change-requests/change-requests-store.ts) | 更新 | ビュー `optionDraft`(404 は「下書きなし」)、`draftActing`・`draftError`、`draftOptions`・`adoptDraft` |
| [`src/features/change-requests/components/OptionDraftReview.tsx`](../samples/frontend/src/features/change-requests/components/OptionDraftReview.tsx) | 新規 | 下書きの作成・確かめ・取り込み |
| [`src/features/change-requests/components/OptionsSection.tsx`](../samples/frontend/src/features/change-requests/components/OptionsSection.tsx) | 更新 | 直せる CR で下書きの枠を出す |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeOptionDraft` |
| [`src/features/change-requests/test-utils/renderWithStore.tsx`](../samples/frontend/src/features/change-requests/test-utils/renderWithStore.tsx) | 更新 | 下書きのビュー・状態・操作 |
| [`src/features/change-requests/__tests__/change-requests-store.test.ts`](../samples/frontend/src/features/change-requests/__tests__/change-requests-store.test.ts) | 更新 | 404・作る・取り込む・失敗 |
| [`src/features/change-requests/components/__tests__/OptionDraftReview.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/OptionDraftReview.test.tsx) | 新規 | 下書きの枠 |
| [`src/features/change-requests/components/__tests__/ContentTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ContentTab.test.tsx) | 更新 | 読み込み中の文が2つになったので、規模の表の有無で見る |

## 1. 見た目

```
選択肢(案)  [案を直す]
 …(今の案)
┌ LLM の下書き(任意)  [下書きを作り直す] ───────────────┐
│ 説明書から LLM(生成の用途のモデル)で案を作ります。…       │
│ 未確認 ・2026/10/22 10:00 に作成 ・gemini-3.5-flash-lite  │
│ 作った後に説明書が変わりました。…(古いとき)             │
│ 取り込めません: ・案2の対象が CR の対象にありません: FR-099 │
│ 説明書に無い要件 ID・数字があります(人が確かめてください): 2 │
│ おすすめ: 案1(理由: …)                                │
│ [案1 …] [案2 …]                                         │
│ [下書きを取り込む]                                       │
└──────────────────────────────────────┘
```

- 下書きの枠は、選択肢の節の中で、直せる CR(下書き・説明済み)だけに出す。合意の後は作れないので出さない。
- 下書きの案は、107-2 の `OptionCards` で今の案と同じ形に出す(見比べやすくするため)。
- 取り込むと今の案を置き換えるので、確かめのダイアログを挟む。説明済みの CR は「下書きに戻ります」と書く。取り込んだ下書きは「取り込み済み」になり、取り込むボタンを出さない。取り込んだ後は、107-2 の編集欄で手で直せる。
- 作るのは LLM なので数秒かかる。作っている間は「下書きを作成中...」で、下書き・取り込みの操作を止める。

## 2. ストア

```ts
// src/features/change-requests/change-requests-store.ts(抜粋)
optionDraft: { draft: OptionDraftRead | null } | null;   // DetailViews。null は未読
draftActing: "create" | "adopt" | null;
draftOptions: (projectId, number) => Promise<boolean>;    // 応答で下書きのビューを置き換える
adoptDraft: (projectId, number) => Promise<boolean>;      // 応答の CR で詳細を置き換える
```

- 下書きは作るまで無く、`GET .../options/draft` は 404(`CR_OPTION_DRAFT_NOT_FOUND`)を返す。これを読み込みの失敗にすると、下書きの無い CR で毎回赤い文が出るので、`fetchOptionDraft` が 404 を `{draft: null}` に読み替える。ビューの値を `{draft}` で包んだのは、「まだ読んでいない(null)」と「読んだが無い(`{draft: null}`)」を分けるため。
- 取り込みは CR を変える(案・状態)ので、`replaceDetail` でタブの内容ごと捨てる。下書きのビューも捨てるので、開き直すと「取り込み済み」の下書きを読み直す。
- 操作の実行中と失敗は、要約の `summaryActing`・`summaryError` と同じ形で `draftActing`・`draftError` に持つ(CR の状態の操作の `acting` と分けるのは、LLM の待ちの間に、見出しの操作まで止めないため)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `change-requests-store.test.ts` | `fetchView("optionDraft")`・`draftOptions`・`adoptDraft` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 404 の読み替え・送る URL・ビューと詳細の置き換えを見るため |
| `OptionDraftReview.test.tsx`(新規) | `OptionDraftReview`(+ `OptionCards`) | Testing Library | ストアの関数(`vi.fn`)── 読み込み・作る・取り込むの呼び出しと、照合の結果の出し分けを見るため |

- 統合スモーク: 枠を開くと下書きを読む。無ければ「下書きはありません。」と「LLM で下書きを作る」。
- 404 は失敗にせず「下書きなし」として読む。作ると下書きのビューを、取り込むと詳細を置き換える。失敗は `draftError`。
- 取り込める下書きは、確かめてから取り込む(説明済みは下書きに戻ると書く)。説明書に無い数字は知らせるだけ。
- 取り込めない下書きは理由を出して取り込むボタンを押せない。古い下書きは作り直しを勧める。
- 取り込み済みは取り込むボタンを出さない。
