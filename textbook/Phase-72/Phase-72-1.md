# Phase-72-1: E2E(ステージ9の流れ)と全 E2E の実行

## この章の目的

ステージ9で入れた日常の操作 ── 認証ページの振り分け・モード選択・一覧の検索と削除・マイページの API キーとモデル・ログアウト ── を、一般の利用者でブラウザで1回通す。新しい spec に足し、既存を含めた全 E2E を流す(#36)。中心は、**一般の利用者が自分の Claude キーを登録すると、レビューのパネルが出る**こと(Phase 67 の登録と Phase 68 の `review_allowed` をつなぐ経路)。

自動実装モード: on([introduction](./Phase-72-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`e2e/stage9-flow.spec.ts`](../samples/frontend/e2e/stage9-flow.spec.ts) | 新規 | 一般の利用者で、認証ページの振り分け → モード選択 → 2つ作って検索 → 削除 → 自分の Claude キーとレビューのモデル → レビューのパネル → ログアウトを通す |
| `devex-api/docker-compose.e2e.yml` | 更新 | E2E 専用の `ENCRYPTION_KEY` を backend に渡す(インフラの設定のため samples に写さない。#21) |

## 要点の抜粋

```ts
// e2e/stage9-flow.spec.ts
await page.goto("/login");
await expect(page).toHaveURL(/\/dashboard/); // ログイン中は認証ページを飛ばす

const search = page.getByLabel("タイトルで検索");
await search.fill(`会議室予約${suffix}`);
await search.press("Enter"); // 入力の途中では一覧を変えない
await expect(page).toHaveURL(/[?&]q=/);

await page.getByRole("button", { name: `「${removed}」を削除` }).click();
await page.getByRole("button", { name: "削除する" }).click();
await expect(page.getByText(`「${removed}」を削除しました`, { exact: true })).toBeVisible();

await page.getByLabel("Claude の API キー").fill("sk-ant-e2e-fake-key-0001");
await page.getByRole("button", { name: "Claude のキーを保存する" }).click();
await expect(page.getByText("登録済み(末尾 …0001)")).toBeVisible();
```

```yaml
# devex-api/docker-compose.e2e.yml
services:
  backend:
    environment:
      E2E_FAKE_LLM: "true"
      ENCRYPTION_KEY: "<E2E 専用の Fernet の鍵>"
```

流れ: 登録・ログイン → `/login` を開くと `/dashboard` → `/projects/new` でモード選択のダイアログ → 1つ目を作ってヒアリング・生成(文書の URL を控える)→ ヘッダーの「Devex」でトップ → 2つ目を作る → ダッシュボードで2つ目の名前を検索(URL に `q`)→ 1つ目は出ない → ゴミ箱 → ダイアログ → トースト・一覧から消える → 文書の画面にレビューのパネルが無い → マイページの「API キー」で Claude のキー → 「モデル」でレビューを Claude・Haiku にして保存 → 文書の画面にパネル(スイッチはオフ)→ メニューの Authentication を開いてログアウト → `/` → `/login` を開ける。

## 全 E2E で見つかったこと

1. **既存の4件は、そのまま通った**(詳細 1.4分・簡易3件 各 20〜23秒)。61-3 の見込みどおり、`e2e/helpers.ts` が使う文言(「新規プロジェクトを作成」・「…で作成する」)は Phase 62・65 で残っていた。Phase 66 の改名は、Phase 66 で `helpers.ts` の登録の欄を「ユーザーネーム」に直してあった。
2. **新しい spec で直した期待**(どれも spec の誤りで、本体は変えていない):
   - トーストは、見える題とは別に読み上げ用の「通知 …」の文を持つので、`getByText` が2つに当たった。完全一致で探す。
   - レビューの用途の選択肢で、「既定に従う(Claude / Claude Sonnet …)」も「Claude」を含むので、`exact: true` で探す。
   - メニューのグループは閉じているので、Authentication を開いてからログアウトを押す。
   - 保護されたページは、ログアウトの後にログインへ**振り分けない**(`RequireAuth` がその場でログインを求めるダイアログを出す。proxy が振り分けるのは認証ページだけ)。ログアウトの確かめは「`/login` を開ける(印の cookie が消えた)」にした。
   - ヒアリングから生成まで含むので、既定の30秒を3分に伸ばした。
3. **キーの登録には暗号の鍵が要る**: 手元の `devex-api/.env` には `ENCRYPTION_KEY` が無い(Phase 67 の申し送り)。E2E のオーバーレイに E2E 専用の鍵を書いた(下の「設計判断」)。

最後に全 E2E 5件が通った(2.8分)。backend は `E2E_FAKE_LLM=true` で起動し直して流し、終わってから通常の設定に戻した。登録の上限は、流す前に dev の Redis の `rate_limit:register_ip:*` と `rate_limit:login_ip:3600:1*` を消して避けた(Phase 60 と同じ)。

## 設計判断

### E2E の暗号の鍵はオーバーレイに書く

鍵が無いと、マイページは「暗号の鍵が設定されていない」と出し、キーを登録できない。E2E を流す人の `.env` に頼ると、鍵の有無で E2E の結果が変わる。E2E のオーバーレイ(`E2E_FAKE_LLM` を足すファイル)に、E2E 専用の固定の鍵を書いた。暗号化するのは偽のキーだけなので、鍵をリポジトリに書いても漏れて困るものは無い。`.env` に自分の鍵があっても E2E の間はこちらが勝つ。その間、開発で登録したキーは「登録し直す」と出るが、通常の起動に戻せば読める。

### レビューのパネルで、自分のキーの経路を確かめる

一般の利用者がレビューを使えるかは、`UserRead.review_allowed`(superuser か、レビューの用途の provider の自分のキーを持つか)で決まる。キーの登録・モデルの保存・パネルの出し分けは別々の Phase(67・68・53)で作ったので、つないで通すのは E2E が初めてになる。レビュー自体を流す経路(受け付け・指摘・採否)は、Phase 60 の spec が superuser で通しているので、この spec ではパネルが出るところまでにした。

### 1本の長いテストにする

画面の流れが前の段の状態(作ったプロジェクト・登録したキー)に依存するので、テストを分けると前提を作り直す手間と登録の回数(1時間10回の上限)が増える。既存の spec と同じく、1本の流れにした。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
| --- | --- | --- | --- |
| `stage9-flow.spec.ts` | 画面の proxy(`src/proxy.ts`)・`ModeSelectDialog`・`ProjectListControls`・`DeleteProjectButton`・マイページの `ApiKeySection`・`ModelSection`・`ReviewPanel` の出し分け・`MenuEntry` のログアウトと、それぞれの API | Playwright(ブラウザで操作) | 偽 LLM(`E2E_FAKE_LLM=true` の backend が返す。キーの確かめも飛ばす)。暗号の鍵は E2E 専用の値 |
| 全 E2E(5件) | 既存の流れが壊れていないこと | 同上 | 同上 |

この章が作成したファイルは、Playwright が流す spec 自身(#15)。`docker-compose.e2e.yml` は spec の起動の前提として使われる。

```sh
cd devex-api && docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d backend
cd ../devex-ui && npx playwright test
cd ../devex-api && docker compose up -d backend   # 通常の設定に戻す
```
