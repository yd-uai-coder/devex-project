# Phase 71 の効果の確認(71-4)

[Phase 71](../../../textbook/Phase-71/Phase-71-introduction.md) の直し(マイルストーンのゴールと単位・DFD のデータストアの書き漏れ・画面の文の変更の波及)を、保存済みの記録とローカルの devex-api・実際の LLM で確かめた記録。2026-10-17。生成は `gemini-3.5-flash-lite`(seed の superuser の既定)。Sonnet のレビューは流していない(`drive71.py` がレビューの設定を一時的にオフにし、終わった後に元へ戻す)。

## 1. LLM なしの確かめ(保存済みの記録に、今の本体を当てた)

### 画面の文の変更の波及(Phase 49 の再生成の6回)

`../../stage7-effect/regen.py` の「今の本体で求め直した印」。`regen.py` は `result.md` を上書きするので、流した後に `git checkout` で Phase 49 の記録に戻した。

| 回 | 前(Phase 49 の本体) | 後(Phase 71) | 見落とし |
|---|---|---|---|
| detailed-1 | 35(過剰 31) | 35(過剰 31) | 0 |
| detailed-2 | 4(過剰 0) | 4(過剰 0) | 0 |
| detailed-3 | 8(過剰 5) | **5(過剰 2)** | 0 |
| simple-1 | 5(過剰 4) | 5(過剰 4) | 0 |
| simple-2 | 3(過剰 2) | **1(過剰 0)** | 0 |
| simple-3 | 1(過剰 0) | 1(過剰 0) | 0 |

- detailed-3 の SCR-003・simple-2 の SCR-002 は、UI 仕様の本文だけが変わり、同じ差分の要件・API が画面の処理の一部に届いていた。画面からの印がその処理に絞られた。
- detailed-2・simple-3 は、画面の変更が正解の処理だけに届く回(後退の見張り)で、変わらなかった。
- detailed-1・simple-1 の過剰は、文書全体の書き直し(変わったもの 13・57)によるもので、この直しの対象外。

### 新しい警告(`count.py` → [`count.md`](./count.md))

- `DFD_STORE_MISSING`: stage7-effect detailed-1 で 3件(49-2 で見つけた F-03 × reference_files・F-04 × chat_messages・F-05 × documents)。detailed-2・3 は 0件。stage8-effect detailed-1(と同じ設計の phase59/schema)で 2件(F-03 × tokens・F-08 × messages)。
- `GOAL_WITHOUT_TASK`: 詳細設計モードの段階7は 8つとも 0件。簡易モードの実装計画書は、WBS を読める20版のうち 9版で、どれも1マイルストーン(フロントエンド 7・CI/CD とバックアップ 1・バックアップ 1)。PR-7 の2例(stage8-baseline simple の M-01「FastAPI と Next.js」・stage8-effect simple-1 v2 の M-01「CI/CD・バックアップ」)が出た。
  - 当てる途中で、機能のマイルストーンのゴールが「フロントエンドでプレビュー」と書く版(gen-lite-simple-r1 の M-04)が出た。計画の規則で機能のタスクはその処理のフロントエンドを含むので、フロントエンドは機能のタスクがあれば作るとみなすように直した(71-1 の非自明な判断)。

## 2. 実際の LLM(直した指示の効果)

Phase 58・59・70 の記録を書き換えないよう、**プロジェクトを複製して**確かめた([`../phase59/copy_project.py`](../phase59/copy_project.py))。生成物は手で書き換えていない。承認は段階2だけ(段階3の生成の入力にするため)。

| drive の名前 | 複製 | 元 | 確かめたこと |
|---|---|---|---|
| `p71-simple` | 3ddea0ed | 4437fd9b(simple-1。v2 に PR-7) | 実装計画書の作り直し 2回 |
| `p71-dfd1` | d0ef8de0 | b2602f06(detailed-1。`DFD_STORE_MISSING` 2件) | 段階2・3 の作り直し |
| `p71-dfd2` | a8f58393 | b2602f06 | 段階2・3 の作り直し |
| `p71-plan` | 19e7c500 | b2602f06 | 段階7 の作り直し 2回 |

| 確かめたこと | 前 | 後(1回目) | 後(2回目) |
|---|---|---|---|
| 簡易の M-01 のゴール | 「…CI/CD・バックアップ基盤が整う」(タスクは Docker と nginx) | 「Docker環境、データベース接続、および nginx の設定が完了し…」 | 「Dockerfile、docker-compose.yml、nginx/conf.d/default.conf を用いた…Docker環境の構築」 |
| 簡易の `GOAL_WITHOUT_TASK` | 1 | **0** / 4マイルストーン | **0** / 4 |
| 段階3の `DFD_STORE_MISSING` | 2 | **0** | **0** |
| 段階7の `GOAL_WITHOUT_TASK` | 0 | 0(M-04 のゴールに GitHub Actions・バックアップ → 同じマイルストーンに `.github/workflows/deploy.yml`・`scripts/backup.sh` のタスク) | 0(ゴールは機能だけ) |

- DFD のデータストア(グループごと): 前は auth に tokens・users、messages に messages。後は auth に refresh_tokens・users、generate に chat_histories(1回目)。
- **1回目の DFD に、日本語の名前のデータストア(「チャットメッセージ」)が1つ出た**(名前は英小文字の複数形の規則がある)。ER のテーブルに無いので `STORE_NOT_IN_ER`(警告)になった。2回目は出なかった。保存するデータをすべて描く規則で、新しいデータストアを描くときに名前の規則が抜けたおそれがある。1/2 なので直していない(申し送り)。

## 費用(実額)

| 内訳 | 見込み | 実際 |
|---|---:|---:|
| Gemini flash-lite(実装計画書 2回・段階2と3 2回・段階7 2回) | 無料枠 | 無料枠 |
| Sonnet のレビュー | 流さない | $0 |
| **合計** | **$0** | **$0** |

## 実行

```bash
# 保存済みの記録に当てる(LLM なし)
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage8-effect/phase71/count.py
PYTHONPATH=devex-api/backend uv run --project devex-api/backend python appendix/stage7-effect/regen.py appendix/stage7-effect/hearing/<回>

# 実際の LLM(複製してから)
cd devex-api
DBURL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/@postgres:/@localhost:/')
DATABASE_URL=$DBURL uv run --project backend python ../appendix/stage8-effect/phase59/copy_project.py <project_id> "(Phase 71 確認用 …)"
cd ../appendix/stage8-effect
PYTHONPATH=. uv run --project ../../devex-api/backend python phase71/drive71.py simple p71-simple phase71/simple-1
PYTHONPATH=. uv run --project ../../devex-api/backend python phase71/drive71.py dfd p71-dfd1 phase71/dfd-1
PYTHONPATH=. uv run --project ../../devex-api/backend python phase71/drive71.py plan p71-plan phase71/plan-1
```
