# Phase 59 の効果の確認(59-6)

[Phase 58](../README.md) の申し送り5件の直し([Phase 59](../../../textbook/Phase-59/Phase-59-introduction.md))を、ローカルの devex-api と実際の LLM で確かめた記録。2026-10-15。生成は `gemini-3.5-flash-lite`、レビューは `claude-sonnet-5-5`、「直ったか」は `claude-haiku-5-5`。

- Phase 58 の記録(b2602f06・4437fd9b・33fdda56・86a37228)を書き換えないよう、**プロジェクトを複製して**確かめた(`copy_project.py`)。正解表・正解例(`../test-spec/truth-*.md`)は付け直していない。
- 生成物は手で書き換えていない。

## 複製したプロジェクト

| drive.py の名前 | 複製 | 元 | 使った確認 |
|---|---|---|---|
| `p59-detailed` | 2d13b5b4 | b2602f06(詳細 detailed-1) | 2 委ねたとき・3 重複 |
| `p59-schema` | 3b0bfc39 | b2602f06 | 1 スキーマ(段階4〜8 を作り直し) |
| `p59-simple` | bafdea59 | 4437fd9b(簡易 simple-1) | 4 簡易の異常系・5 本文の `session_id` |
| `p59-spec-simple` | 02bbe558 | 33fdda56(簡易) | 5 正解例 |
| `p59-spec-detailed` | 445aa091 | 86a37228(詳細。持ち主を seed の superuser に変えた) | 5 正解例 |

## 結果

| # | 確かめたこと | 前(Phase 58) | 後 |
|---|---|---|---|
| 1 | 段階4 のモジュール一覧にモデルの行 / 段階7 のスキーマの単位 / `NO_SCHEMA_UNIT` | 行なし / 単位なし / 1件 | 1回目(モジュール一覧の指示だけ)は行なし → 構成図にモデルのパッケージを置かせて **`app/models/*.py` 6行**、段階7 は最初のマイルストーンの基盤の単位にモデル6つ、**`NO_SCHEMA_UNIT`・`TABLE_WITHOUT_UNIT` 0件** |
| 2 | 聞き直しで「おすすめでよい」 | adopted・要約「おすすめの設定値を適用する」→ 再レビューで同じ指摘 | 判定は **open のまま**(3回とも)。返信は指示だけではカードを出さなかった(2回)→ コードが委ねた発言に注記を足すと、**具体値のカード**(「パスワード8文字以上、メール確認あり、JWT(30分/14日・HttpOnly Cookie)」「ログイン失敗5回まで/分、チャット50回/時間など」)。再生成の要件は前の版のまま写された → 要件定義書の指示に「観点の表の変化も変更のきっかけ」を足すと **FR-011・FR-012 に値が入った**(FR-003 のアクセス制御も残った) |
| 3 | 「直ったか」の重複 | 同じ指摘を3回ずつ(12件中 4件が重複) | 段階4〜8 を続けて承認(14件)・判定を3つ並行(9件)で、**(指摘, 版) の重複 0件** |
| 4 | 簡易の手順書の異常系 | 機能の3単位すべて正常系だけ | 1回目(指示が「ステータスごとに異常系」だけ)は**異常系だけ**になった → 「正常系に加えて」に直して2回、**3単位すべて正常 1〜3 + ステータスごとの異常系**、`NO_ERROR_TEST` 0件 |
| 4' | dev の DB の簡易の手順書に `NO_ERROR_TEST` | ― | 13本(複製を除く)の機能の単位 39 のうち、エラー欄のある 27 単位で 22件(番号を書かず「エラーとなること」と書いた1件の誤検知は、観点の言葉を見るようにして消した) |
| 5 | テスト仕様書の正解例の当たり | 簡易 12/17・詳細 28/38 | **簡易 13/17(+一部1)・詳細 33/38(+一部1)**。ケース数は 19→24・38→53 |
| 5' | 本文の `session_id` | 他人のセッションへの送信のテストが無い | `POST /api/v1/chat/messages` に「session_id にほかの利用者の ID」(IT-029) |

### 5 の判定の内訳

- 簡易で新しく当たった: TS-15 画面のエラー表示(ST-002「空のまま送信・API エラー → エラー表示とやり直し」)。一部: TS-10 AI の失敗のあとやり直せる(ST-007 は不正な入力で起こしている。IT-011 は 500 で保存されない)。まだ落ちる: TS-5 他人の献立(本文の `token` で本人を決める API で、`*_id` も `{id}` も無い)・TS-7 AI で生成する・TS-13 献立1件の削除(設計に無い)。
- 詳細で新しく当たった: TD-16 失敗で保存しない・TD-24 再生成・TD-26 直近3件・TD-28 コピー・ダウンロード・TD-32 空送信の表示(ST-022〜025・ST-004・ST-006)。一部: TD-30 サマリの確認(修正依頼は無い)。まだ落ちる: TD-12 `{id}` の 401・TD-17 LLM の上限超過・TD-29 版の切り替え・TD-38 回数上限の表示。
- 要件ごとのテストは「FR-00x の要件どおり〜が提供されること」と浅い書き方が多い(中身の手順は要件の文を言い直しただけ)。それでも、一覧に行があることで、要件の中身(コピー・ダウンロード)と失敗の後の状態(保存されない・やり直せる)がテストになる。

## 費用(実額)

| 内訳 | 見込み | 実際 |
|---|---:|---:|
| Sonnet documents のレビュー 1回(入力 12.4k・出力 7.8k) | $0.10 | $0.10 |
| Haiku「直ったか」23件(承認の後 14件・並行 9件。入力 約 13万・出力 約 8k) | $0.01 | 約 $0.02 |
| Gemini flash-lite | 無料枠 | 無料枠 |
| **合計** | $0.11(最大 $0.23) | **約 $0.12** |

2 の要件定義書の確認(指示を直した後の作り直し)は、Sonnet をもう一度流すと最大の見込みを超えるので、レビューを一時的にオフにして作り直し、要件の行を直接見た(再レビューはしていない)。

## 実行

```bash
cd devex-api
DBURL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/@postgres:/@localhost:/')
DATABASE_URL=$DBURL uv run --project backend python ../appendix/stage8-effect/phase59/copy_project.py <project_id> "(Phase 59 確認用)" [<user_id>]
DATABASE_URL=$DBURL PYTHONPATH=backend uv run --project backend python ../appendix/stage8-effect/phase59/error_test_counts.py
cd ../appendix/stage8-effect
uv run --project ../../devex-api/backend python phase59/schema_run.py p59-schema phase59/schema   # 段階4 を作り直して 5〜8
uv run --project ../../devex-api/backend python drive.py rehearing p59-detailed <finding_id ...>
uv run --project ../../devex-api/backend python drive.py say p59-detailed phase59/hearing/input/u3.txt
uv run --project ../../devex-api/backend python drive.py testspec p59-spec-simple phase59/test-spec/spec-simple.json --create
```

`concurrent_fix_checks.py` は判定を3つ並行に流す(dev の Redis・DB と `.env` の鍵を使う)。

## ファイル

| パス | 中身 |
|---|---|
| `copy_project.py` | プロジェクトの複製(行の ID と、JSON・本文の中の古い ID を付け替える) |
| `schema/` | 1。`stage4.json`・`stage7.json`・実行の記録 `run.log`・zip |
| `hearing/` | 2・3。発言(`input/`)・観点の表・チャットの履歴・レビュー(前・後)・要件定義書 v3(指示を直す前)・v4(後) |
| `concurrent_fix_checks.py` | 3 |
| `simple-procedure/` | 4。`stage8_try1.json`(直す前の指示)・`try2`・`try3` |
| `error_test_counts.py`・`error_test_counts.json` | 4' |
| `test-spec/` | 5。`spec-simple`・`spec-detailed`(正解例の題材)・`spec-simple1`(`session_id`) |
