# Phase-60-2: E2E(設計レビューの流れ)と全 E2E の実行

## この章の目的

ステージ8の中心の操作 ── superuser がレビューをオンにし、レビューの指摘を見て採否を決める ── を、ブラウザで1回通す。簡易モードの spec に足し、既存を含めた全 E2E を流す(#36)。採用の先(差し戻し・聞き直し・「直ったか」)は [60-1](./Phase-60-1.md) の契約テストが固定しているので、E2E は画面(パネルの出る条件・スイッチ・区切りの表・指摘の表・採否)を確かめる。

自動実装モード: on([introduction](./Phase-60-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 更新 | `registerAndLogin` が登録したメールアドレスを返す。`promoteToSuperuser`(DB を直接更新して superuser にする)を足す |
| [`e2e/devex-flow.spec.ts`](../samples/frontend/e2e/devex-flow.spec.ts) | 更新 | 一連のフローでテスト仕様書のタブも見る(ダウンロードはそのタブの `test_spec.md`)。superuser がレビューをオンにして指摘を採用するテストを足す |

## 要点の抜粋

```ts
// e2e/helpers.ts
export function promoteToSuperuser(email: string) {
  const sql = `UPDATE users SET is_superuser = true WHERE email = '${email}'`;
  execFileSync("docker", ["compose", "-f", `${DEVEX_API_DIR}/docker-compose.yml`, "exec", "-T",
    "postgres", "sh", "-c", `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "${sql}"`]);
}
```

```ts
// e2e/devex-flow.spec.ts
promoteToSuperuser(email);
await page.reload();
const panel = page.getByLabel("AI 設計レビュー", { exact: true });
const toggle = panel.getByRole("checkbox", { name: "AI 設計レビューを使う" });
// チェックは設定を保存してから付くので、check() ではなく押してから待つ
await toggle.click();
await expect(toggle).toBeChecked();
await panel.getByRole("button", { name: "文書の生成の後をレビューする" }).click();
await expect(gates).toContainText("レビュー済み", { timeout: 30 * 1000 });
```

足したテストの流れ: 登録 → 簡易モードで作成・ヒアリング・生成(一般の利用者なので、生成の後は自己診断)→ パネルが無いことを確かめる → superuser にして読み込み直す → パネル(スイッチはオフ、「オフ(生成の後は、今の自己診断をチャットに出します)」)→ オン → 区切りは「未レビュー」→「レビューする」→ 5秒ごとの取り直しで「レビュー済み」・「指摘 2件」→ 開く → 偽の指摘2件の文 → 2件を採用 →「採用 2 ・ 却下 0 ・ 保留 0 ・ 未判断 0」と「チャットで聞き直す(1件)」。

## 全 E2E で見つかったこと

1. **足す前の既存3件は、そのまま通った**。Phase 57 の申し送り「E2E のタブ・ステッパーの行の数」は、タブや段階の数を数える期待が無かったので壊れていなかった。再生成のダイアログに起点の選択が入った(Phase 53 の完了後の調整)が、既定の起点のまま押すので通った。
2. **スイッチは `check()` では押せない**: 画面のチェックは API で保存してから付く(制御された入力)。Playwright の `check()` は押した直後に状態が変わらないと失敗するので、`click()` してから `toBeChecked()` を待つ。
3. **ダウンロードの名前が変わった**: 一連のフローのタブの確認にテスト仕様書を足すと、最後に開いたタブがテスト仕様書になり、「ダウンロード(.md)」は `test_spec.md` を返した(表示中のタブの文書)。期待をそれに合わせた ── テスト仕様書のダウンロードの確かめにもなる。
4. **登録のレート制限**: 全 E2E は利用者を4人登録する(Phase 50 までは3人)。登録は IP ごとに1時間10回まで(`REGISTER_RATE_LIMIT_PER_IP_PER_HOUR`)で、ブラウザの IP(`172.22.0.1`)の鍵が同じ1時間に積み上がり、3回目の全体の実行で登録が止まった。dev の Redis の `rate_limit:register_ip:3600:172.22.0.1` だけを消して流し直した。申し送りに残す。

最後に全 E2E 4件が通った(詳細 1.2分・簡易3件 各 18〜20秒)。backend は `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。

## 設計判断

### superuser への昇格は DB を直接更新する

superuser は画面・API から作れない(本番も手で昇格させる。[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.5節)。E2E の backend は dev の docker compose の DB を使うので、`docker compose exec postgres psql` で更新する。seed の superuser を使う案は、seed を流していない環境で失敗し、実行のたびに同じ利用者のプロジェクトが積み上がるので採らなかった。メールアドレスは `uniqueEmail` が作る英数字だけなので、SQL に直接埋めてよい。

### レビューは「生成の後にオン」→ ボタン、で流す

E2E の利用者は生成の時点ではまだ一般の利用者(昇格するには登録が先に要る)なので、生成の後の自動のレビューは流れない。オンにしてからパネルの「レビューする」で流す ── 手動の受け付け(`trigger="manual"`)の経路を画面で通すことになる。自動の経路は 60-1 が通す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `devex-flow.spec.ts`「superuser が設計レビューをオンにして…」 | 画面の `ReviewPanel`・`FindingTable` と、レビューの API(設定・受け付け・区切り・採否) | Playwright(ブラウザで操作) | 偽 LLM(`E2E_FAKE_LLM=true` の backend が返す)。superuser の昇格は DB の直接の更新 |
| `devex-flow.spec.ts`「ログイン→…一連フロー」 | テスト仕様書のタブとダウンロード(足した部分) | 同上 | 同上 |
| 全 E2E(4件) | 既存の流れが壊れていないこと | 同上 | 同上 |

```sh
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test
cd ../devex-api && docker compose up -d backend   # 通常の設定に戻す
```
