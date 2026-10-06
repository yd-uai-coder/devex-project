# Phase-24-2: E2E の共通の操作と、簡易モードの E2E の修復(FE)

## この章の目的

Phase 4 で作った簡易ドキュメントモードの E2E(`e2e/devex-flow.spec.ts`)は、Phase 15 の変更で2か所が壊れていた。この章でそれを直す。

- 「新規プロジェクトを作成」が、リンクからボタンに変わった。押すとモード選択ダイアログが開く。
- 「この内容で設計書を生成する」の後に、確認ダイアログ(「生成する」)が出るようになった。

あわせて、登録からヒアリングまでの操作を `e2e/helpers.ts` に切り出す。24-3 の詳細設計モードの E2E も、同じ順で始まるため(#17)。

自動実装モード: on([introduction](./Phase-24-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 新規 | 定型 | `registerAndLogin`・`createProject(page, mode, intake)`・`completeHearing(page, messages)` |
| [`e2e/devex-flow.spec.ts`](../samples/frontend/e2e/devex-flow.spec.ts) | 更新 | 定型 | 2本のテストの前半を helpers に置き換え、簡易ドキュメントモードを明示して選ぶ |

## 要点の抜粋

モード選択ダイアログの各カードのボタンは、見た目の文字が「このモードで作成する」で同じになっている。そこで、`aria-label`(「{モード}で作成する」)で見分ける。

```ts
// e2e/helpers.ts
await page.getByRole("button", { name: "新規プロジェクトを作成" }).click();
await page.getByRole("button", { name: `${MODE_TITLES[mode]}で作成する` }).click();
await expect(page).toHaveURL(new RegExp(`/projects/new\\?mode=${mode}`));
```

生成の確認ダイアログの「生成する」は `exact` で探す。「この内容で設計書を生成する」と部分一致しないようにするため。

```ts
// e2e/helpers.ts
await page.getByRole("button", { name: "この内容で設計書を生成する" }).click();
await page.getByRole("button", { name: "生成する", exact: true }).click();
await expect(page).toHaveURL(/\/projects\/[^/]+\/documents/, { timeout: 30 * 1000 });
```

再生成のテストにも、確認ダイアログ(「設計書を再生成しますか」)がある。ダイアログの「再生成する」は、画面のボタンと同じ名前なので、後から出るほう(`.last()`)を押す。

## 設計判断(要点のみ)

- 修復を「ダイアログを押す行を足す」だけにせず、helpers に切り出した。24-3 の spec も同じ操作で始まる。共通化を今必要としている消費者が2つある(#17)。
- 段階ごとの操作(生成・図の承認・段階の承認)は helpers に入れない。使うのは詳細設計の spec だけなので、その spec の中に置く(24-3)。
- 壊れたことに気づくのが遅れた原因は、E2E を手元でしか流していないこと。CI で流すかは、[introduction](./Phase-24-introduction.md) の申し送りに残した。

## 動作確認(実施済み)

```bash
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test e2e/devex-flow.spec.ts
# 2 passed
npx tsc --noEmit && npx eslint e2e   # エラー・警告なし
```
