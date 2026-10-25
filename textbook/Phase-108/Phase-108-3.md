# Phase-108-3: 案の選択と合意 / 却下

## この章の目的

Phase 104 のリンクからの合意・却下の API(`POST /api/v1/share/{token}/decision`)を、クライアントのページの「ご判断」から使えるようにする。案のある CR では案を選んで合意し、却下では理由を書く。先に押した方で決まり後から直せないので、記録の前に確かめる。

自動実装モード: on([introduction](./Phase-108-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/share/api/types.ts`](../samples/frontend/src/features/share/api/types.ts) | 更新 | `SharedDecisionCreate` |
| [`src/features/share/api/sharedApi.ts`](../samples/frontend/src/features/share/api/sharedApi.ts) | 更新 | `postSharedDecision` |
| [`src/features/share/shareOps.ts`](../samples/frontend/src/features/share/shareOps.ts) | 更新 | `DECISION_REASON_MAX`・`decisionProblem`・`isNotWritable` |
| [`src/features/share/share-store.ts`](../samples/frontend/src/features/share/share-store.ts) | 更新 | `deciding`・`decisionError`・`decide` |
| [`src/features/share/components/SharedDecisionForm.tsx`](../samples/frontend/src/features/share/components/SharedDecisionForm.tsx) | 新規 | ご判断(案・理由・合意 / 却下・確かめ) |
| [`src/features/share/components/SharedChangeRequestPageContent.tsx`](../samples/frontend/src/features/share/components/SharedChangeRequestPageContent.tsx) | 更新 | ご判断を置く・断られた旨 |
| [`src/features/share/test-utils/sharedFixtures.ts`](../samples/frontend/src/features/share/test-utils/sharedFixtures.ts) | 更新 | `makeSharedWithOptions` |
| [`src/features/share/test-utils/renderShare.tsx`](../samples/frontend/src/features/share/test-utils/renderShare.tsx) | 更新 | 判断の状態 |
| [`src/features/share/__tests__/shareOps.test.ts`](../samples/frontend/src/features/share/__tests__/shareOps.test.ts) | 更新 | 判断の確かめ |
| [`src/features/share/__tests__/share-store.test.ts`](../samples/frontend/src/features/share/__tests__/share-store.test.ts) | 更新 | 合意・却下・先に判断されていたとき |
| [`src/features/share/components/__tests__/SharedDecisionForm.test.tsx`](../samples/frontend/src/features/share/components/__tests__/SharedDecisionForm.test.tsx) | 新規 | 案の選択・確かめ |
| [`src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx`](../samples/frontend/src/features/share/components/__tests__/SharedChangeRequestPageContent.test.tsx) | 更新 | 並び・断られた旨 |

## 1. 見た目

```
ご判断
合意するときは、案を1つ選んでください(案の中身と規模は説明書の「選択肢」「変更の規模」にあります)。
┌ ○ 案1 3件まで  ★ 開発者のおすすめ ┐
│ 上限の値だけを足す。手間は小さい   │
└────────────────────────────────────┘
┌ ○ 案2 上限と履歴の件数            ┐
└ 履歴の画面にも手が入る。…         ┘
おすすめの理由: まず上限だけを入れ、使われ方を見るため
理由(却下では必須。合意では任意)
[                                  ]
[合意する] [却下する]
   └ 確かめ「この変更に合意しますか」 選んだ案: 案1 3件まで。「山田」として記録します。記録した判断は、このページから直せません。
     [キャンセル] [合意を記録する]
```

- **案**: カードに名前・結果・おすすめの印を出し、ラジオで選ぶ。初めはどれも選ばない(開発者の合意のダイアログと同じ。おすすめを既定にすると、読まずに合意できてしまう)。案を選ばずに合意を押すと知らせる。却下では案を送らない(`option: null`)。変える要件と規模はカードに重ねず、説明書の md の節を指す(API の案は名前・結果・おすすめだけを返す)。
- 案のカードは、開発者の側の `OptionCards` を使い回さず、ここに書いた。型が違い(開発者の案は対象と変更後の案を持つ)、見せる中身もクライアント向けに絞るため。共通化を駆動する同じ事実が無い(#17 の判定)。
- ラジオの入れ物は素の `<div role="radiogroup">`。Phase 107 の画面確認で、ダイアログの説明(`<p>`)の中に `<fieldset>` を入れて DOM の入れ子の誤りが出たので、確かめのダイアログの説明は文だけにした。
- **確かめ**: 先に押した方で決まり、判断を直す仕組みは無い(Phase 104 の決定)ので、`ConfirmDialog` で、選んだ案と記録する名前と「直せません」を見せる。
- **理由**: 却下では必須(devex-api も 422 で断る)、合意では任意(空なら記録の理由は「共有リンクで合意」)。
- **記録の後**: 応答(判断の後の閲覧の形)でページを置き換える。状態が判断済みになり、ご判断とお名前の欄が消え、頭に判断の結果が出る。
- **断られたとき**: 409 `SHARE_LINK_NOT_WRITABLE`(押す前に開発者が判断した・直し始めた)は、読み直して今の状態を出し、その上に断られた旨を出す(ご判断の欄は消えるので、ページの本体で出す)。409 `SHARE_EXPLANATION_CHANGED` はコメントと同じく読み直しを促す。

## 2. 純粋関数とストア

```ts
// src/features/share/shareOps.ts(抜粋)
export const DECISION_REASON_MAX = 2000;              // devex-api の REASON_MAX
export function decisionProblem(input: {
  decision: "agreed" | "rejected"; name: string; option: number | null; reason: string; optionCount: number;
}): string | null                                      // 名前 → 案(合意で案があるとき)→ 理由(却下)の順に確かめる
export function isNotWritable(err: unknown): boolean

// src/features/share/share-store.ts(抜粋)
deciding: "agreed" | "rejected" | null; decisionError: string | null;
decide: (input: { decision; option: number | null; reason: string }) => Promise<boolean>;
// { decision, name(trim), fingerprint, option(却下では null), reason(trim) } を送る
```

- `decide` の失敗で読み直すときは、`load` が `decisionError` を下ろすので、読み直しの後に `decisionError` を入れる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `shareOps.test.ts` | `decisionProblem`・`isNotWritable` | vitest のテスト関数 | スタブ不要 ── 渡した値だけから結果が決まるため |
| `share-store.test.ts` | `decide` | ストアの関数を直接呼ぶ | fetch(`stubFetch`)── 本文と、409 の後の読み直しを見るため |
| `SharedDecisionForm.test.tsx`(新規) | `SharedDecisionForm` | Testing Library | ストアの `decide`(`seedShareStore`)── 送る中身と確かめの流れだけを見るため |
| `SharedChangeRequestPageContent.test.tsx` | ページの本体(`SharedDecisionForm`・`SharedComments` を通る) | Testing Library | ストアの `load` |

- 統合スモーク: 開いているリンクで 説明書 → お名前 → ご判断 → コメント の順に出る。
- 案とおすすめの印・理由を出し、初めはどの案も選ばない。案を選ばないと合意を記録しない。
- 案を選んで合意すると、確かめてから選んだ番号で記録する。却下は理由が要る。確かめでやめると記録しない。
- ストア: 合意は名前・指紋・案を送り、応答で置き換える。却下では案を送らない。先に開発者が判断していたら、読み直して判断済みを出し、断られた旨を持つ。
- 判断済みで断られた旨があれば、ご判断の欄の代わりに出す。
