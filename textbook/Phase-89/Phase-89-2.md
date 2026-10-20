# Phase-89-2: CR の流れの E2E と全 E2E

## この章の目的

ステージ11 の流れ(合意済みの版 → CR → 説明書 → 説明済み → 合意 → 文書への反映 → 検証 → 新しい版 → たどる記録)を、ブラウザで1本の spec にし、既存を含めた全 E2E を流す(#36)。Phase 87・88 では画面のテストと API のテストだけで、画面をまたいだ流れは通していなかった。

自動実装モード: on([introduction](./Phase-89-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`e2e/change-request-flow.spec.ts`](../samples/frontend/e2e/change-request-flow.spec.ts) | 新規 | 詳細設計モードの文書から B-1 を作り、CR-1 を受付から検証まで進めて B-2 に入れ、たどる記録を確かめる(1つのテスト) |

## 要点の抜粋

```ts
// e2e/change-request-flow.spec.ts
// CR の状態のバッジ(見出しの横。`状態: {名前}` の aria-label を持つ)
async function expectStatus(page: Page, label: string) {
  await expect(page.getByLabel(`状態: ${label}`, { exact: true })).toBeVisible({ timeout: GENERATION_TIMEOUT });
}

// ── 検証: 印は付かない。文書の側(画面・API)を確認済みにすると、検証済みにできる
const documents = page.getByLabel("文書の側の確認").getByRole("checkbox");
// チェックは保存の応答の後に付く(制御された入力)ので、check() でなく押してから待つ
for (let index = 0; index < count; index += 1) {
  await documents.nth(index).click();
  await expect(documents.nth(index)).toBeChecked();
}
```

- **段階を作らない**(着手時の相談で決定): 段階1〜7 を承認するには、既存の `detailed-design-flow.spec.ts` と同じく1分かかる。偽の LLM は再生成で同じ文書を返すので、段階を承認しても反映で印は付かない。段階に付く印・段階への反映・比較の中身は devex-api の CR のテスト(Phase 85・86)が固定しているので、E2E は画面のつながりに絞った。
- **対象は `FR-001`**: 偽の要件定義書の Must で、偽の外部設計書の画面(`SCR-001`)と API がこの要件を持つ。そのため、予測に文書の側の要素が出て、検証の「文書の側の確認」まで通る(印が付かなくても、検証の条件を確かめられる)。
- **CR は版の中身から作る**(Phase 88 の完了後の調整): `この版を基準に変更要求を作る →` から作成のページへ移り、基準の版 B-1 が固定されることを URL で確かめる。
- **説明書はダウンロードで確かめる**: ファイル名 `cr-1-explanation.md`、見出し、5節(`## 1.`〜`## 5.`)、変更後の案の文。
- **B-2 の初期値**: 検証済みの CR を選ぶと、相手はそのまま、メモと理由は `CR-1: …` の形で入る(Phase 88 の `prefillAgreement`)。
- **たどる記録**: 基準と入れた版(`基準: B-1 → 入れた版: B-2`)、状態の遷移、反映で作り直した版(`要件定義書 版2`)、入れた版。合意の相手はたどる記録に出ないので、内容のタブで確かめる(下の「作業中に分かったこと」)。

## 流し方

- `playwright.config.ts` は、backend(`docker-compose.yml` + `docker-compose.e2e.yml`)と UI(`npm run dev`)を立てる。手元で 3000 番・8000 番が動いていると、`reuseExistingServer` でそれが使われる。
- この Phase では、ユーザーの `npm run dev`(3000 番)と実 LLM の backend が動いていたので、Phase 79 と同じく止めずに流した。
  - backend を、E2E のオーバーレイと CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直した。
  - `NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドした画面を 3100 番で開いた。
  - `baseURL` だけを 3100 番にした一時的な設定で全 spec を流した(流した後に消した)。
  - 流した後、3100 番を止め、backend を通常の compose(実 LLM)に戻し、通常のビルドを作り直した。

## 結果

- 新しい spec: spec の側の誤りを3つ直して成功(本体は変えていない)。
  - 文書の側の確認のチェックは、保存の応答の後に状態が変わる(制御された入力)。`check()` は押した直後に状態を確かめるので失敗した。押してから `toBeChecked` で待つ形にした。
  - B-2 の理由とメモの初期値は `CR-1: …` の形(複数の CR を選んだときに見分けるため)。期待値を直した。
  - たどる記録に合意の相手が出なかった(下)。
- 全 E2E: **10件成功**(既存9 + 新1。2.6分)。続けてもう1回流して **10件成功**(2.7分)。

## 作業中に分かったこと

- **たどる記録に合意の相手が出ない**: 「合意」の行は日時と状態の遷移だけで、相手・メモ・理由は内容のタブの合意の記録にある。4つの問いの「誰の合意で」には答えられる(CR の記録)が、たどる記録だけを見る人には見えない。行のメモに出すかを画面確認で決める([89-4](./Phase-89-4.md))。
- **偽の LLM でも版のモデル名は設定の名前**: 反映の行に `モデル: gemini-3.5-flash-lite` が出た。偽の LLM は設定のモデル名をそのまま記録に残す(本物との差は無い)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `change-request-flow.spec.ts` | devex-ui の画面(文書・合意済みの版の一覧と中身・CR の作成のページ・CR の詳細の5つのタブ)+ devex-api(束・CR・予測・説明書・反映・検証・たどる記録の API) | Playwright(ブラウザ) | LLM だけを偽物にする(`E2E_FAKE_LLM`)── ヒアリング・文書の生成・再生成を決定的にし、費用をかけないため。DB・Redis・バックグラウンドの生成は本物 |

- この章が作成したファイルは spec だけで、`helpers.ts` の `registerAndLogin`・`createProject`・`completeHearing` を import する(どれも Phase 24〜79 から。前方 import は無い)。
