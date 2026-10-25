---
name: run-devex-ui
description: devex-ui の画面をヘッドレスの Chromium で開き、ログインして操作し、スクリーンショットとブラウザのエラーを確かめる(画面確認・UI の挙動の確認・「ブラウザで見たい」のとき)。開発サーバーと devex-api の起動、ログインに使う E2E の利用者、確認用のデータの用意、撮影のスクリプト shot.mjs を含む。
---

# devex-ui の画面をブラウザで動かして確かめる

単体テスト(jsdom)では出ない誤り(DOM の入れ子・hydration・実 API の応答の形)を、本物のブラウザで確かめる手順。Phase 107 の画面確認で作った(そのとき、合意のダイアログの `<fieldset>` が `<p>` の中に入る誤りを見つけた)。

## 1. 起動を確かめる(多くの場合、もう動いている)

```bash
curl -s http://localhost:8000/health                                    # {"status":"ok","database":"ok","redis":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login    # 200
readlink /proc/$(ss -ltnp | grep ':3000' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)/cwd   # devex-ui の作業ツリーか
```

- 動いていなければ: devex-api は `cd devex-api && docker compose up -d`(ポート 8000)。devex-ui は `cd devex-ui && npm run dev`(ポート 3000。Bash の `run_in_background` で起こし、`until curl -sf http://localhost:3000/login >/dev/null; do sleep 1; done` で待つ)。
- 3000 の開発サーバーはユーザーが起こしたものであることが多い。止めない(止めるときは `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`)。作業ツリーの変更は開発サーバーがそのまま読み込む。
- 新しい API を使う画面なら、バックエンドにその API があるかを確かめる: `curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; print([k for k in json.load(sys.stdin)['paths'] if 'share' in k])"`。

## 2. ログインする利用者と、確認用のデータ

- **E2E が残した利用者を使う**。パスワードは E2E の固定値 `S3cret-pass`(`devex-ui/e2e/helpers.ts` の `PASSWORD`)。メールアドレスは `e2e-<種類>-<数字>@example.com`。
- 使えるプロジェクトと CR の状態は [`find-projects.sql`](./find-projects.sql) で探す:
  ```bash
  cd devex-api && docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ../.claude/skills/run-devex-ui/find-projects.sql
  ```
  CR の画面は `e2e-cr-…` の詳細設計モードのプロジェクト(合意済みの版 B-1・B-2 と検証済みの CR-1 がある)。
- **トレンド追跡アプリ(`example-user@example.com`)は使わない**。効果測定の題材で、触ると測り直しになる。
- 下書き・説明済みの CR など、画面を動かすのに要る状態が無ければ、E2E の利用者で API を呼んで作る(捨てのプロジェクトなので作ってよい。作ったものは報告に書く):
  ```bash
  B=http://localhost:8000/api/v1
  TOK=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"<E2E の利用者>","password":"S3cret-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
  curl -s -X POST $B/projects/<id>/change-requests -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d @cr.json
  ```
  本文の形は devex-api の `app/schemas/change_request.py`(`ChangeRequestCreate`)。要件 ID は `GET $B/projects/<id>/baselines/<n>/requirements` で見る。

## 3. 撮る・動かす(shot.mjs)

devex-ui の中から動かす(`@playwright/test` と Chromium は devex-ui のものを使う。`chromium-cli` は無い)。

```bash
cd devex-ui
DEVEX_EMAIL=<E2E の利用者> node ../.claude/skills/run-devex-ui/shot.mjs \
  /projects/<id>/change-requests/2 --wait 変更の規模 --steps <手順.mjs> --out $CLAUDE_JOB_DIR/tmp/shots
```

- ログイン → パスを開く → `--wait` の文字が出るまで待つ → 全体を撮る(`01-page.png`)→ 手順ファイルを流す。
- 終わりに `PROBLEMS` として、ページの例外・console の誤り(React の警告を含む)・400 以上の応答(メソッドと URL つき)を出す。失敗すると `failed.png` を撮って終了コード 1。
- 手順ファイル(`--steps`)は、ジョブの tmp に書く:
  ```js
  export default async function (page, shot) {
    await page.getByRole("tab", { name: "共有" }).click();
    await page.getByText("共有リンク").first().waitFor();
    await shot("share");               // 02-share.png
  }
  ```
- **撮った画像は Read で必ず見る**。真っ白・ログイン画面のままは失敗。

## 4. よくあるつまずき

- **ラベルが重なる**: `getByLabel("理由")` が規模の表の下の「規模の理由と注記」にも当たる、`getByLabel("作る")` が期限の欄・ダイアログにも当たる、など。`getByRole("textbox", { name: "理由" })`・`getByRole("button", { name: "作る", exact: true })` のように役割で絞る。
- **確かめのダイアログ**(`ConfirmDialog`)の確定のボタンは `aria-label` が確定の文言。ダイアログの外にも同じ名前のボタンがあることが多いので、`exact: true` か `getByRole("dialog")` の中で探す。
- **Tamagui の `Button` の無効**は `disabled` 属性でなく `aria-disabled="true"`。
- **想定どおりの失敗の応答**(PROBLEMS に出ても不具合でない): ログイン前の `401 POST /auth/refresh`、下書きの無い CR の `404 GET .../options/draft`(画面は「下書きなし」として読む)。開発サーバーは React の StrictMode で effect が2回走るので、同じ GET が2回出る。
- 撮った画像・手順ファイルは `$CLAUDE_JOB_DIR/tmp` に置く(`/tmp` は並行するジョブと取り合う)。devex-ui の作業ツリーにファイルを残さない。

## 5. 報告に書くこと

- 動かした画面と操作、撮った画像の場所、PROBLEMS のうち想定外のもの。
- 確認のために作った・変えたデータ(どの利用者・プロジェクトに何を作ったか。状態を変えたか)。
- 見つけた不具合を直したら、samples・教材にも同じ直しを入れる(#21・#38)。
