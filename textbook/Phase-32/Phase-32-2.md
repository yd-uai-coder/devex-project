# Phase-32-2: E2E(段階8の生成)と全 E2E の実行(FE)

## この章の目的

両モードの E2E を、段階8で単位を選んで手順書を生成するところまで延ばす。あわせて、既存を含めた全 E2E を流す(#36)。Phase 27〜31 では E2E を流していなかったので、その間に壊れていたところをここで見つけて直す。

自動実装モード: on([introduction](./Phase-32-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 更新 | `generateProcedureDocs(page, unitIds)`: 単位を選んで生成し、すべて「生成済」になるまで待つ |
| [`e2e/detailed-design-flow.spec.ts`](../samples/frontend/e2e/detailed-design-flow.spec.ts) | 更新 | 段階7の承認の後に段階8へ進み、M-01-T01〜T03 を生成する。実装手順書の zip がまだ押せないこと |
| [`e2e/devex-flow.spec.ts`](../samples/frontend/e2e/devex-flow.spec.ts) | 更新 | 段階8だけの画面で M-01-T01・T02 を生成する。見出しの探し方を直す |

FE のパスは `devex-ui/` 基準。E2E の spec 自体がテストなので、表はこの3つだけ。

## 要点の抜粋

```ts
// e2e/helpers.ts
export async function generateProcedureDocs(page: Page, unitIds: string[]) {
  const units = page.getByRole("table", { name: "単位の一覧" });
  for (const id of unitIds) {
    await units.getByRole("checkbox", { name: `${id} を生成する` }).check();
  }
  await page.getByRole("button", { name: /^選んだ単位の手順書を生成する/ }).click();
  // 行は単位の列のボタンで探す(依存の列に、ほかの単位の ID が出るため)
  for (const id of unitIds) {
    const row = units
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: `${id} の詳細を開く` }) });
    await expect(row).toContainText("生成済", { timeout: 30 * 1000 });
  }
}
```

```ts
// e2e/detailed-design-flow.spec.ts(段階を承認し、完了ダイアログで次の段階へ進む)
await expect(page.getByText(`段階${stage}-${title}を承認しました。`)).toBeVisible();
await page.getByRole("button", { name: "次の段階へ進む" }).click();
```

## 全 E2E で見つかったこと

1回目は3件中2件が落ちた。どちらも spec の側の誤りで、画面と偽 LLM には問題が無かった。

| spec | 落ちた理由 | いつから | 直し方 |
|---|---|---|---|
| `detailed-design-flow.spec.ts` | 段階7の承認の後、「次の段階へ進む」が無い(「閉じる」だけ)ことを期待していた。Phase 27 で段階8ができてから、段階7の次に段階8があるので「次の段階へ進む」が出る | Phase 27(E2E を流していなかったので気づかなかった) | どの段階でも「次の段階へ進む」を押す。段階7の後は段階8が開くので、そのまま段階8の生成へ続ける |
| `devex-flow.spec.ts` | 見出し「実装手順書」が、画面の見出しと作業領域の「段階8 実装手順書」の2つに一致した(Playwright の strict mode) | Phase 31(足した期待を流していなかった) | `exact: true` で探す |
| (この章で足した部分) | 単位の行を ID の文字で探すと、M-01-T02 の行も依存の列に「M-01-T01」を含むので2行に一致した | この章 | 単位の列のボタン(`… の詳細を開く`)を持つ行で探す |

直した後、3件とも成功した(詳細設計モード 1.1 分、簡易モード 2件 各17秒前後)。

## 設計判断

### 段階8の生成を helpers に置く(#17)

段階ごとの操作(生成・図の承認・段階の承認)は、詳細設計の spec の中に置いてきた([Phase 24-3](../Phase-24/Phase-24-3.md))。使うのがその spec だけだったからである。段階8の生成は、両モードの spec が使う。今この共通化を必要とする消費者が2つあるので、`helpers.ts` に置いた。

### 待つのは「生成済」の表示

生成はバックグラウンドで走り、画面は5秒ごとに段階の一覧を取り直す。生成ボタンの文言(「生成中」)が消えるのを待つより、目的の結果(選んだ単位がすべて「生成済」)を待つほうが、何を確かめたかがはっきりする。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| 詳細設計モードの画面の流れ(作成 → ヒアリング → 段階1〜7 → zip → 段階8の生成) | Playwright(`detailed-design-flow.spec.ts`) | 偽 LLM(`E2E_FAKE_LLM=true`)── 実際の Gemini を呼ばず、決定的に動かすため。偽 LLM の出力が経路を通ることは [32-1](./Phase-32-1.md) が固定する | 段階8の見出し、3単位が「生成済」、実装手順書の zip が押せない(承認前) |
| 簡易モードの画面の流れ(作成 → ヒアリング → 4文書 → 段階8の生成) | Playwright(`devex-flow.spec.ts`) | 同上 | 2単位が「生成済」 |
| 文書の再生成 | Playwright(`devex-flow.spec.ts` の2件目) | 同上 | 変更なし。全 E2E の一部として流した |
