# Phase-119-1: 反映の前の確かめ

## この章の目的

本番へ出す前に、出す版(devex-api の `stage11-15`・devex-ui の `main`)が CI と同じ検査を通り、既存を含めた全 E2E が通ることを確かめる(#36)。あわせて、出すコミットの並びとマイグレーションの head、samples とリンクを確かめる。

自動実装モード: on([introduction](./Phase-119-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`backend/tests/unit/test_material_change_requests.py`](../samples/backend/tests/unit/test_material_change_requests.py) | 更新 | docstring の「スタブ」の2行を折り返した(`ruff check` の E501。整形だけなのでタグなし。#29) |

## 確かめたこと

| 項目 | 結果 |
| --- | --- |
| devex-api のユニット(`uv run pytest`) | **1978件成功**(integration 48件は対象外。CI と同じ) |
| devex-api の `ruff check .` | **1件の E501**([Phase 115](../Phase-115/Phase-115-introduction.md) で足したテストの docstring が101・106文字)→ 折り返して 0件 |
| devex-ui のユニット(`vitest run`) | pytest と並べて流した1回目は 10ファイル・13件が時間切れ。単独で `--maxWorkers=4` で流し直して **235ファイル・1482件成功**(持ち越しの「並列のテストのタイムアウト」と同じ) |
| devex-ui の `tsc --noEmit`・`eslint` | 0件・警告1件(既存の `streamChat.test.ts`) |
| devex-ui の `npm run build` | 成功(E2E 用と通常の2回) |
| 全 E2E(11 spec・16件) | **16件成功(4.1分)を2回** |
| 出すコミット | `git fetch` の後、`origin/main..stage11-15`(devex-api)は30件、`origin/main..main`(devex-ui)は14件。どちらもステージ11〜14 と Phase 118(と「デプロイの準備」)のコミットだけ |
| マイグレーション | `alembic heads` は `d5a1c7e3f926` の1本 |
| `samples_check.py`(`--api-since origin/main --ui-since origin/main`) | 一致 1185 / 並び順のみ差 8 / 例外 5・不一致 0・本体のみ 0 |
| `link_check.py` | リンク 10204件 / 切れ 0件 |

## E2E の流し方

[Phase 117-2](../Phase-117/Phase-117-2.md) と同じ。ユーザーの `npm run dev`(3000番)は止めなかった。

- backend は、E2E のオーバーレイと、`CORS_ORIGINS` に 3100番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直した。
- 画面は `NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドして 3100番で開き、`baseURL` だけを 3100番にした一時的な設定で全 spec を流した。
- 3100番には、今日の早い時間に立てた古い `next start` が残っていたので、止めてからビルドし直した。
- 流した後は 3100番を止め、backend を通常の compose に戻し(E2E・CORS の環境変数が無いことを確かめた)、通常のビルドを作り直した。一時的な設定は消した。`test-results/.last-run.json`(追跡されているファイル)は元に戻した。

## 設計判断

### lint の1件は本体で直した

devex-api の CI(`deploy.yml`)は `ruff check .` を通らないとテストもデプロイも走らない。PR を出してから落ちると、10.8節の手順4で止まるので、反映の前に直した。整形だけの変更なので、samples にも同じ形で反映し、タグは付けない(#29)。`ruff format` は使わない(関係の無いファイルを書き換えるため)。

### タグの欠け

devex-api・devex-ui のどちらにも `phase-100` 以降のタグが無い(最後は `phase-99`)。10.8節の手順6は `phase-118` を確かめるので、コマンドの案を [introduction](./Phase-119-introduction.md) の「未消化の申し送り」に置いた(付けるのはユーザー。#35)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| devex-api のユニット全体 | API の各層 | pytest | 各テストのとおり(LLM は FakeLLM、DB はテスト用の SQLite) |
| devex-ui のユニット全体 | 画面の部品・ストア・API の呼び出し | Vitest + Testing Library | 各テストのとおり(API はモック) |
| 全 E2E(16件) | devex-ui の画面 + devex-api | Playwright | LLM と Google の検証だけを偽物にする(`E2E_FAKE_LLM`・`E2E_FAKE_GOOGLE`)── 費用をかけず決定的に流すため。DB・検査は本物 |
| `test_material_change_requests.py` | (この章の変更は docstring だけ) | pytest(5件成功を確かめた) | 変更なし |
