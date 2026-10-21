# Phase-99-2: 合意の精度の E2E と全 E2E

## この章の目的

ステージ12 の画面の流れを E2E で1本通し、既存を含めて全部流す(#36)。通す流れは、合意済みの版で合意 → CR を渡さない再生成でも「合意済み」のまま → 確認事項で推測の要件を確認済み(ダイアログ)→ 採用になり、合意の出どころが「採用にする」→ 行の履歴、である。

自動実装モード: on([introduction](./Phase-99-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/e2e/agreement-flow.spec.ts`](../samples/frontend/e2e/agreement-flow.spec.ts) | 新規 | 上の流れを画面で通す(Phase 完了後の調整で、確認事項の見え方の変更に合わせて直した) |

## 要点の抜粋

```ts
// devex-ui/e2e/agreement-flow.spec.ts(抜粋)
await expect(agreementPanel(page)).toContainText("合意済み 0");      // 合意の前
// … B-1 を作る → 文書の画面へ戻る
await expect(agreementPanel(page)).toContainText("合意と違う 0");
// … 再生成(偽の LLM は同じ文書を返す)
await table.getByRole("button", { name: new RegExp(`${escape(ASSUMED)} を確認済みにする$`) }).click();
await dialog.getByRole("button", { name: "採用にして合意を記録する" }).click();
await page.getByLabel("状態で絞る").selectOption("confirmed");        // 消えた項目も同じ表に
await expect(table).toContainText("確認済み(採用して合意)");
```

- 偽の LLM の要件定義書は、推測の要件を1つ(「通信を HTTPS で暗号化する」)持つ。確認事項はこれを使う。
- 偽の LLM の再生成は同じ文書を返すので、戻す要素は出ない。戻す処理と、戻した要素の見せ方は、devex-api の保護のテストと devex-ui の部品のテストが固定している。

## 流し方

Phase 89 と同じ。ユーザーの `npm run dev`(3000 番)と実 LLM の backend が動いていたので、止めずに流した。
- backend は、E2E のオーバーレイと CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直した。
- 画面は、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドして 3100 番で開いた。
- `baseURL` だけを 3100 番にした一時的な設定で、全 spec を流した。
- 流した後は 3100 番を止め、backend を通常の compose に戻して、通常のビルドを作り直した。

## 結果

- 新しい spec は、spec の側の誤り2つを直して通った。
  - 確認のダイアログが2つ(Tamagui の中身と外側の `dialog`)に当たっていたので、名前で絞った。
  - 未確認がほかに無いと表ごと消えるので、表の中の文を数で確かめる形にした。
- 全 E2E は **11件成功**(既存10 + 新1。約3分)を2回。Phase 完了後の調整の後に、もう一度2回流して、2回とも 11件成功した。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `agreement-flow.spec.ts` | devex-ui の画面(文書・合意済みの版・確認事項)+ devex-api(束・合意の記録・保護・確認事項・履歴の API) | Playwright(ブラウザ) | LLM だけを偽物にする(`E2E_FAKE_LLM`)── ヒアリング・生成・再生成を決定的にし、費用をかけないため。DB・Redis・バックグラウンドの生成は本物 |
