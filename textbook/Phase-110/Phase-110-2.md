# Phase-110-2: 共有リンクの流れ・言い換えの E2E と全 E2E

## この章の目的

ステージ13 の画面の流れを E2E で2本通し、既存を含めて全部流す(#36)。1本目は、開発者が CR に案を書いて共有リンクを作り、クライアントがログインせずに読んで、コメント・案の選択・合意をし、開発者が出どころとコメントを見て返信する流れ。2本目は、名称を言い換える偽の LLM(Phase 105)で、言い換えがあっても段階1 の処理 ID・合意・外部連携の1行・確認事項のメモが保たれる流れ。

自動実装モード: on([introduction](./Phase-110-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`frontend/e2e/share-link-flow.spec.ts`](../samples/frontend/e2e/share-link-flow.spec.ts) | 新規 | 案2つ → 共有リンク → クライアント(別のブラウザの文脈)が閲覧・コメント・案1 で合意 → 開発者が出どころ「共有リンク」と返信 |
| [`frontend/e2e/paraphrase-flow.spec.ts`](../samples/frontend/e2e/paraphrase-flow.spec.ts) | 新規 | 概要に `[言い換え]` → 段階1 → 合意の前の再生成と段階1 の作り直し(ID は同じ・名称は言い換え)→ B-1 → 推測の利用者にメモ → 再生成(合意と違う 0・外部連携 1・メモが残る) |
| [`frontend/e2e/change-request-flow.spec.ts`](../samples/frontend/e2e/change-request-flow.spec.ts) | 更新 | 説明書のダウンロードのボタンを、説明書のタブの中で探す(見出しの操作にも同じボタンがあり、2つに当たっていた) |

## 要点の抜粋

```ts
// devex-ui/e2e/share-link-flow.spec.ts(抜粋)
// URL の行だけを読む(枠の全体の文字列では、すぐ後ろのボタンの「URL をコピー」がつながる)
const shareUrl = (await created.getByText(/\/share\//).textContent())?.trim();
const clientContext = await browser.newContext();          // ログインしていないクライアント
await client.getByRole("radio", { name: "案1 いつでも取り消せる" }).check();
const confirm = client.getByRole("dialog", { name: "この変更に合意しますか" });
await expect(record).toContainText("出どころ: 共有リンク");
```

```ts
// devex-ui/e2e/paraphrase-flow.spec.ts(抜粋)
const after = await functionNames(page);
expect(after).toEqual(before.map((name) => `${name}${SUFFIX}`)); // ID は F-01・F-02 のまま
await expect(agreementPanel(page)).toContainText("合意と違う 0");
await expectIntegrations(page, 1);                                // 言い換えた連携が重ならない
```

- **言い換えの順**: 偽の LLM の段階1 は、外部設計書に言い換えた名前があるときだけ言い換える。合意の後の再生成では保護が名前を合意の形へ戻すので、段階1 の言い換えは**合意の前**の再生成の後に確かめる。
- **確かめのダイアログ**は名前で絞る(`getByRole("dialog", { name: … })`。Phase 108 の注意)。
- **既存の spec の直し**: CR の流れの spec の「説明書をダウンロード(.md)」が、見出しの操作と説明書のタブの2つに当たって失敗した。spec の側をタブの中に絞った(本体は変えない)。Phase 99 の後のどの変更で2つに当たるようになったかは特定していない。

## 流し方

Phase 99 と同じ。ユーザーの `npm run dev`(3000 番)を止めずに流した。
- backend は、E2E のオーバーレイと、CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直した。共有リンクの上限は開発用の compose の 1000回。
- 画面は、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドして 3100 番で開いた(`next dev` は `.next/dev` を使うので、3000 番のサーバーに触らない)。
- `baseURL` だけを 3100 番にした一時的な設定で、全 spec を流した。
- 流した後は 3100 番を止め、backend を通常の compose に戻し、通常のビルドを作り直した。一時的な設定は消した。

## 結果

- 新しい spec は、spec の側の誤り3つを直して通った(URL の読み取り・読み込みの後の見出し・返信の入力欄に当たるラベル)。言い換えの spec は1回目で通った。
- 全 E2E は、既存の CR の流れの spec が2回とも同じ所で失敗した(上の locator)。直した後、**13件成功**(既存11 + 新2。約4分)を2回。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `share-link-flow.spec.ts` | devex-ui の画面(CR の内容・共有のタブ、`/share/<トークン>`)+ devex-api(案・共有リンク・コメント・共有リンクからの判断の API) | Playwright(開発者とクライアントの2つのブラウザの文脈) | LLM だけを偽物にする(`E2E_FAKE_LLM`)── 文書の生成を決定的にし、費用をかけないため。DB・Redis・回数の上限は本物 |
| `paraphrase-flow.spec.ts` | devex-ui の画面(文書・段階1・合意済みの版・確認事項)+ devex-api(保護・段階1 の ID の引き継ぎ・利用者の ID・外部連携の重複の除き) | Playwright | 言い換える偽の LLM(印 `[言い換え]` のあるプロジェクトだけ)── 実 LLM の名前の揺れを決定的に作るため |
| `change-request-flow.spec.ts`(更新) | 既存の CR の流れ | Playwright | 既存と同じ |
