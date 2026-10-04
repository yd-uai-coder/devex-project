# Phase-24-3: 詳細設計モードの通しの E2E(FE)

## この章の目的

詳細設計モードを、ブラウザで通しで動かす E2E を作る。流れは次のとおり。

1. 詳細設計モードでプロジェクトを作る。
2. ヒアリングの後、要件定義と外部設計の2文書だけができることを確かめる。
3. SCR-008 で段階1〜7を生成・承認する。
4. 詳細設計書と実装計画の zip をダウンロードし、中身のファイルを確かめる。

ステージ4のマイルストーン5(段階を承認して詳細設計書をダウンロードできる)を、画面の操作で確かめるテストになる。

学習モード([introduction](./Phase-24-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`e2e/detailed-design-flow.spec.ts`](../samples/frontend/e2e/detailed-design-flow.spec.ts) | 新規 | **コア** | 詳細設計モードを段階1〜7 → zip まで通す。段階の操作の小さな関数(`generateDraft`・`approveDiagram`・`approveStage`・`saveStage`)を持つ |

## 要点の抜粋

生成はバックグラウンドで動く。画面は5秒ごとに段階の一覧を取り直す(`useStageGenerationPolling`)。そこで、生成の後は固定の時間で待たず、ボタンの文言が「下書きを作り直す」に変わるのを待つ。

```ts
// e2e/detailed-design-flow.spec.ts
async function generateDraft(page: Page) {
  await page.getByRole("button", { name: "下書きを生成する" }).click();
  await expect(page.getByRole("button", { name: "下書きを作り直す" })).toBeVisible({
    timeout: GENERATION_TIMEOUT,
  });
}
```

図の「承認」は、図のエディタのボタンで、段階の「承認する」とは別のもの。`exact` で見分ける。

配置の無い図は、開くと自動レイアウトが走る。その間、「承認」は押せない(承認には配置が要るため)。そこで、押せるようになるまで待ってから押す。

```ts
// e2e/detailed-design-flow.spec.ts
async function approveDiagram(page: Page) {
  const approve = page.getByRole("button", { name: "承認", exact: true });
  await expect(approve).toBeEnabled({ timeout: GENERATION_TIMEOUT });
  await approve.click();
  await expect(approve).toBeHidden({ timeout: GENERATION_TIMEOUT });
}
```

段階を承認すると、完了ダイアログが出る。段階1〜6は「次の段階へ進む」で次の段階へ移る。段階7だけは「閉じる」しか出ないことも確かめる。

zip の中身は、ライブラリを足さずに確かめる。zip のローカルファイルヘッダには、ファイル名が平文(UTF-8)で入っているので、そのバイト列を探す。

```ts
// e2e/detailed-design-flow.spec.ts
function zipEntriesInclude(content: Buffer, name: string): boolean {
  return content.includes(Buffer.from(name, "utf-8"));
}
```

## 段階ごとの操作

| 段階 | 操作 | 承認の前提 |
|---|---|---|
| 1 機能一覧 | 「下書きを生成する」 | なし(生成した `draft` をそのまま承認できる) |
| 2 データフロー | グループ「reservations」を選んで保存 → 生成 → DFD のタブで図を承認 | DFD の承認(`DFD_NOT_APPROVED`) |
| 3 データモデル | 生成 → ER を承認 | ER の承認 |
| 4 ソフトウェア構造 | 生成 → 構成図を承認 | 構成図の承認 |
| 5 主要処理の手順 | 「F-01 予約を登録する」を選んで保存 → 「手順の無い処理の下書きを生成する」→ 手順の索引が出るまで待つ | なし |
| 6 処理ロジックの詳細 | 「app/services/reservation.py の ReservationService.create」を選ぶ → 「生成前に保存する」→「このタブの未生成を生成する」→ 関数ごとの詳細のタブが出るまで待つ | なし |
| 7 横断事項と実装計画 | 生成 | なし |

段階2で、グループを選ばずに承認することもできる。その場合、DFD が無いので、段階3の CRUD の照合(DFD の読み書きとの突き合わせ)が試されない。そこで、グループを選ぶ。

段階6の関数は、F-01 と F-02 の両方のタブに「共通」として出る(偽 LLM はどの処理にも同じ手順を返すため)。そこで `.first()` で選ぶ。

## 設計判断

### 待つ対象は「画面の状態の変化」

生成の完了は、5秒ごとのポーリングで画面に届く。偽 LLM ならすぐ終わるが、画面が気づくのは次のポーリングのとき。固定の時間で待つと、遅すぎる(テストが長くなる)か、短すぎる(不安定になる)かのどちらかになる。

そこで、生成が終わったら必ず起きる画面の変化を待つ。

- ボタンの文言が変わる。
- 索引の表が出る。
- 承認が押せるようになる。

上限の30秒は、ポーリングの5秒の数回分。

### 承認の前提を、承認の操作の中で待つ

図の承認には配置が要る。配置は、画面で図を開いたときの自動レイアウトで用意される。段階の承認には、図の承認が要る。

E2E では、それぞれの承認ボタンが押せるようになるのを待つ。これで、この前提の連鎖を、明示的な sleep 無しに順に満たしていく。24-1 の契約テストでは、同じ連鎖をサービスのメソッド(`compute_layout` → 図の `approve` → 段階の `approve`)で書いた。

### 段階6は「飛ばす」ではなく生成する

「飛ばす」(0件で承認)は Phase 21 の単体テストで確かめてある。E2E では関数を1つ生成し、次の2つまで通す。

- 05↔06 の紐づけ(段階5の呼び出し先・関数と、段階6の項目の一致)
- 06章の出力

## テスト観点(#14)

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `詳細設計モードで段階1〜7を承認し、…zip をダウンロードする` | devex-ui の詳細設計モードの画面と、devex-api の段階・図・出力の API の結合 | Playwright(chromium)の画面操作 | `E2eFakeLLM`(`E2E_FAKE_LLM=true` で backend の中で有効になる)。LLM だけを偽物にし、DB(PostgreSQL)・Redis・レイアウトエンジンは本物を使う |

偽 LLM の出力が検証を通ることは、24-1 で別に固定してある。そこで、この E2E が落ちたら、先に 24-1 のテストを流し、原因を画面側と偽 LLM 側に切り分ける。

## 動作確認(実施済み)

```bash
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test e2e/detailed-design-flow.spec.ts
# 1 passed(約55〜60秒)
cd ../devex-api && docker compose up -d backend   # 本物の LLM に戻す
```

1回目は、作成画面の「モード: 詳細設計モード」を確かめる行で落ちた。`createProject` がチャット画面まで進んだ後に、作成画面の文字を探していたため。モードは URL(`?mode=detailed`)で確かめているので、この行を削除した。
