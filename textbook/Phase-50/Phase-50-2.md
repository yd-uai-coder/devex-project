# Phase-50-2: E2E(変更の影響の流れ)と全 E2E の実行

## この章の目的

ステージ7の中心の操作 ── 段階を直して承認し直すと、下流の段階に見直しの印が付き、印を確認済みにしてから承認し直す ── を、ブラウザで1回通す。詳細設計モードの E2E の最後に足し、既存を含めた全 E2E を流す(#36)。印の付き方そのものは [50-1](./Phase-50-1.md) の契約テストが固定しているので、E2E は画面の操作(パネル・ステッパー・承認の止まり方)を確かめる。

自動実装モード: on([introduction](./Phase-50-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`e2e/detailed-design-flow.spec.ts`](../samples/frontend/e2e/detailed-design-flow.spec.ts) | 更新 | 段階8の生成の後に、段階1の概要を直す → 「承認すると届く」→ 承認し直す → 段階2の印と止まる承認 → 確認済み → 承認し直す、を足す |

## 要点の抜粋

```ts
// e2e/detailed-design-flow.spec.ts
// 入力が変わった「古い」段階では、承認のボタンの名前が「このまま承認し直す」になる
function stageApproveButton(page: Page): Locator {
  return page.getByRole("button", { name: /^(承認する|このまま承認し直す)$/ });
}

// 変更の影響: 直した段階1では「全段階」に切り替えて、変わったものと「承認すると届く」を見る
await selectStage(page, 1, "機能一覧");
await summary.fill(`${await summary.inputValue()}(取消の期限も検証する)`);
await saveStage(page);
const panel = await openImpactPanel(page);
await panel.getByRole("button", { name: "全段階" }).click();
await expect(panel.getByRole("table", { name: "変わったもの" })).toContainText("fn:F-01");

// 承認し直すと段階2〜7 に計7つ(段階8はまだ承認していないので付かない)
await approveStage(page, 1, "機能一覧");
await expect(panel).toContainText("変更の影響(未確認 7)");

// 段階2は承認で理由が出て、確認済みにすると承認し直せる
await stageApproveButton(page).click();
await expect(page.getByText(/見直しの印が残っています/)).toBeVisible();
await panel.getByRole("button", { name: "段階2(未確認 1)" }).click();
await panel.getByRole("button", { name: "この段階の未確認をすべて確認済みにする" }).click();
await approveStage(page, 2, "データフロー");
```

足したヘルパー `selectStage`(ステッパーで段階を選ぶ)・`openImpactPanel`(たたんだまま出たパネルを開く)は、spec の中に置いた。使うのはこの spec だけ(#17)。

## 全 E2E で見つかったこと

開発用の backend を `E2E_FAKE_LLM=true`(`docker-compose.e2e.yml`)で起動し直して流し、終わってから通常の設定に戻した。

1. **足す前の全 E2E**: 3件とも成功(詳細設計モード 1.0 分、簡易モード 2件 各18秒前後)。Phase 41〜49 の変更(段階の承認・作業領域・簡易モードの文書の生成)で壊れた期待は無かった。
2. **足した流れの1回目〜3回目**(spec の誤り、3つ):
   - ステッパーの名前の正規表現の `(` を逃がしていなかった。
   - 「変更の影響」パネルは選んでいる段階に届いた印だけを出す(Phase 44 の完了後の調整)。直した段階1を選んでいると「この段階に届いた印はありません」と出て、変わったものの表も出ない。「全段階」に切り替えるようにした。
   - 下流の段階は入力が変わって「古い」になり、承認のボタンの名前が「このまま承認し直す」になる。ボタンの探し方を両方の名前に合わせた。
3. **直した後の全 E2E**: 3件とも成功(詳細設計モード 1.2 分、簡易モード 18.3秒・17.0秒)。

2つ目は画面の仕様どおりだが、直した段階でパネルを開くと何も無いように見える。困らないかを本番での確認の表に足した([50-4](./Phase-50-4.md)。「未消化の申し送り」)。

## 設計判断

### 段階8の印は数えない

E2E は段階8の手順書を生成するが、承認していない(承認と実装手順書の zip は契約テストが通す)。印は一度承認した段階にだけ記録する(Phase 43 の決定)ので、段階8には付かない。契約テスト(段階8も承認済み)とは数が1つ違う(7 と 8)。

### 印の件数は合計とステッパーで見る

印のキー(`summary:F-01` など)は契約テストが固定しているので、E2E は画面に出る合計(「未確認 7」→「6」)・ステッパーの「見直し 1」・段階の絞り込みのボタンを見る。偽 LLM の出力を変えて印の数が変わったら、契約テストと E2E の両方が落ちる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `detailed-design-flow.spec.ts`(足した部分) | devex-ui の段階1の編集・保存・承認、「変更の影響」パネル(絞り込み・確認済み)、ステッパーの印、承認の止まり方と理由の文 | Playwright(ブラウザの操作) | devex-api の LLM だけ偽物(`E2E_FAKE_LLM=true` の `E2eFakeLLM`)。DB・Redis は開発用の本物 |

```sh
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test
cd ../devex-api && docker compose up -d backend   # 通常の設定に戻す
```
