# Phase-40-3: E2E(規模のカード・「採用にする」)と全 E2E の実行

## この章の目的

#36 により、E2E は Phase 32 から流していなかった。ステージ6(Phase 34〜39)はチャット画面と文書の生成を変えたので、既存の E2E を全部流して壊れたものを直す。あわせて、ステージ6で増えた画面の操作のうち、ユーザーが選んだ2つ ── **規模のカードを選んで送る**操作と、要件定義書のパネルの**「採用にする」** ── を E2E に足す(Phase 35・36 からの申し送り)。

自動実装モード: on([introduction](./Phase-40-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 更新 | `completeHearing`: 最初の発話の規模のカードで先頭の選択肢を選び、1回目の文と一緒に送る(回答済みになるのを待つ)。3回送った後、観点の表の見出しが「必須はすべて決まりました」になるのを待つ |
| ── ここからテスト ── | | |
| [`e2e/devex-flow.spec.ts`](../samples/frontend/e2e/devex-flow.spec.ts) | 更新 | 文書のタブの「E2E Fake」を `.first()` で探す。ダウンロードの後、要件定義書のタブで「NFR-002 を採用にする」を押し、出どころの件数が「ユーザー 4 / 採用 1 / 推測 1」→「ユーザー 4 / 採用 2 / 推測 0」に変わり、ボタンが消えることを確かめる |

`detailed-design-flow.spec.ts` は変えていない(`completeHearing` を通して規模のカードを選ぶ操作が入る)。

## 要点の抜粋

```ts
// e2e/helpers.ts
const scaleCard = page.getByRole("group", { name: "選択肢カード: 規模" });
await scaleCard.getByRole("radio").first().check();
for (const [index, message] of messages.entries()) {
  await messageBox.fill(message);
  await page.getByRole("button", { name: "送信" }).click();
  ...
  if (index === 0) {
    await expect(scaleCard).toContainText("回答済み");
  }
}
await expect(page.getByText("観点の表 ── 必須はすべて決まりました").first()).toBeVisible();
```

```ts
// e2e/devex-flow.spec.ts
const sources = page.getByLabel("要件の出どころ");
await expect(sources).toContainText("ユーザー 4 / 採用 1 / 推測 1");
await sources.getByRole("button", { name: "NFR-002 を採用にする" }).click();
await expect(sources).toContainText("ユーザー 4 / 採用 2 / 推測 0");
```

## 全 E2E で見つかったこと

直す前に、既存の3件をそのまま流した。ヒアリングの流れ(発話3回で十分 → 生成)は3件とも通った。Phase 39 の introduction の見込み(偽 LLM の判定は最後の発言を根拠にするので、取り込みの規則が変わっても流れは変わらない)どおりだった。Phase 39 の申し送り「E2E の文言(まとめが表の箇条書きに変わった)」も、spec がまとめの文言を見ていないので影響はなかった。

| spec | 落ちた理由 | いつから | 直し方 |
|---|---|---|---|
| `devex-flow.spec.ts`(1件目) | 文書のタブで `getByText("E2E Fake")` が11個の要素に一致した(Playwright の strict mode)。要件定義書が model から表に組み立てられ、行ごとに偽物の文字が出るようになった | Phase 36(要件定義書のモデル化)。外部設計書(Phase 37)も同じ | `.first()` で探す(文書が表示されたことを見るのが目的のため) |

直した後、カードと「採用にする」を足して、3件とも成功した(詳細設計モード 1.1 分、簡易モード 2件 各18秒前後)。開発用の backend を `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。

## 設計判断

### カードは helpers で、全 spec が選ぶ(#17)

規模のカードは、両モードの最初の発話に必ず付く(Phase 35 完了後の調整)。カードを選ぶ操作を簡易モードの spec だけに入れると、詳細設計モードの spec は「カードを無視して文で答える」流れのまま残り、画面の主な使い方が片方でしか通らない。`completeHearing` の消費者は2つの spec なので、helpers に入れた。

### 「採用にする」は簡易モードの1件目だけ

要件定義書のパネルは両モードで同じ部品なので、1か所で足りる。ダウンロードは表示中のタブの文書を落とすので、ダウンロード(実装計画書)の後に要件定義書のタブへ戻って押す。件数は偽物の要件定義書で決まる(ユーザー4 = FR2・技術スタックと規模の制約、採用1 = 可用性、推測1 = セキュリティ)ので、偽物を変えたらここも変わる ── 件数の意味は [40-2](./Phase-40-2.md) の契約テストが固定する。

### 待つのは観点の表の見出し

3回目の送信の後、生成のボタンを押す前に、観点の表の見出しが「必須はすべて決まりました」になるのを待つ。生成のボタンは完了判定が十分なときに出るが、表の見出しを待てば「観点の表で完了した」ことを画面で確かめたことになる。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| 簡易モードの画面の流れ(作成 → 規模のカード → ヒアリング → 4文書 → 「採用にする」→ 段階8の生成) | Playwright(`devex-flow.spec.ts`) | 偽 LLM(`E2E_FAKE_LLM=true`)── 実際の Gemini を呼ばず、決定的に動かすため。偽 LLM の出力がサービスの経路を通ることは [40-2](./Phase-40-2.md) が固定する | カードが回答済みになる、観点の表の見出し、出どころの件数の変化とボタンが消えること |
| 詳細設計モードの画面の流れ(作成 → 規模のカード → ヒアリング → 段階1〜7 → zip → 段階8の生成) | Playwright(`detailed-design-flow.spec.ts`) | 同上 | 変更なし(helpers を通してカードを選ぶ)。全 E2E の一部として流した |
| 文書の再生成 | Playwright(`devex-flow.spec.ts` の2件目) | 同上 | 同上 |

```sh
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test
cd ../devex-api && docker compose up -d backend   # 通常の設定に戻す
```
