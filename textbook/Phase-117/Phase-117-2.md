# Phase-117-2: 取り込みの E2E と全 E2E

## この章の目的

ステージ14 の取り込みの流れ(資料の追加 → 違いの取り出し → 確かめる点を閉じる → 違いを選んで CR の下書き → 資料の側の「CR-n にした」)を E2E で1本通し、既存を含めて全部流す(#36)。

自動実装モード: on([introduction](./Phase-117-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/e2e/material-intake-flow.spec.ts`](../samples/frontend/e2e/material-intake-flow.spec.ts) | 新規 | B-1 → 資料の一覧から議事録を足す → B-1 と比べて取り出す(未確認3・弾いた1)→ 確かめる点を理由つきで閉じる → 追加と変更を選んで CR-1 の下書き(背景に資料の題・対象 FR-001)→ 資料のページで2件が「CR-1 にした」 |

既存の spec は直していない(束の表の列を数える spec は無かった)。

## 要点の抜粋

```ts
// devex-ui/e2e/material-intake-flow.spec.ts(抜粋)
const MINUTES = [
  `- ${ADDED}[違い:add:req:FR-001]`,          // 偽の LLM の印。印を除いた行の文が引用になる
  `- ${CHANGED}[違い:change:req:FR-001]`,
  `- ${QUESTION}[違い:question:-]`,
  `- ${UNKNOWN}[違い:change:req:FR-999]`,     // 束に無いキー → 検査で弾かれる
].join("\n");
// 本文の欄のラベルには文字数の表示も入るので、先頭で当てる
await page.getByRole("textbox", { name: /^本文/ }).fill(MINUTES);
await page.getByRole("button", { name: "最新の版 B-1 と比べて違いを取り出す" }).click();
await page.getByRole("checkbox", { name: `「[E2E Fake] ${ADDED}」を選ぶ` }).check();
await page.getByRole("button", { name: "選んだ違いから CR の下書きを作る" }).click();
```

- 偽の LLM の違いは、資料の本文の印で決まる(Phase 114)。引用は印を除いた行の文なので、検査(引用が資料にある・対象のキーが束にある)は本物と同じに働く。束に無い `req:FR-999` の行で「弾いた」の群も通す。
- 確かめる点は CR にできないので、理由をつけて閉じる(状態は「捨てた」の群に入り、「閉じた: <理由>」と出る)。

## 流し方

Phase 110 と同じ。ユーザーの `npm run dev`(3000 番)を止めずに流した。
- backend は、E2E のオーバーレイと、CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直した。
- 画面は、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドして 3100 番で開いた。
- `baseURL` だけを 3100 番にした一時的な設定で、全 spec を流した。
- 流した後は 3100 番を止め、backend を通常の compose に戻し、通常のビルドを作り直した。一時的な設定は消した。

## 結果

- 新しい spec は、spec の側の誤り1つ(本文の欄のラベルに文字数の表示が入り、名前「本文」と完全一致しない)を直して通った(約11秒)。
- 全 E2E は **14件成功**(既存13 + 新1。約4分)を2回。
- devex-ui の `tsc --noEmit` と、新しい spec の `eslint` は通った。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `material-intake-flow.spec.ts` | devex-ui の画面(資料の一覧・追加・資料のページ・違いの一覧・CR の詳細)+ devex-api(資料・違いの取り出し・捨てる・CR の下書き) | Playwright | LLM だけを偽物にする(`E2E_FAKE_LLM`)── 印で違いを決定的に作り、費用をかけないため。検査・DB・束は本物 |
