# ステージ8のベースライン(Phase 51-1)

> 2026-10-19 の整理で、生成物・入力・実行スクリプトは削除した。結果と判定はこの文書に残る(文中のファイル名は当時の名前)。

AI 設計レビューの方式を比べるためのものさし。題材の文書に欠陥を仕込み、正解表をレビューを流す前に書いてから、方式ごとに3回ずつ流して当たり・見落とし・揺れ・費用を数える。分析と判定は Phase 51 の教材に書く。

## 題材

| 題材 | 元 | 仕込み |
|---|---|---|
| `subjects/simple/`(S) | `stage7-effect/hearing/simple-2/` の4文書 | 5件(正解表の S-SEED) |
| `subjects/detailed/`(D) | `stage7-effect/hearing/detailed-3/` の要件定義書・外部設計書 | なし |

## 方式

| 方式 | 中身 | 状態 |
|---|---|---|
| `self_diagnosis`(c) | 今の自己診断(`doc_generator_service._self_diagnose` と同じ入力・プロンプト・`gemini-3.5-flash-lite`) | 済み(3回) |
| `structured_lite`(d) | 同じ flash-lite に構造化レビューの指示 + 観点の表 + 決定的な検証(L0) | 済み(3回) |
| `freetext_lite`(d') | (d) と同じ指示・入力で、出力だけ自由文 | 済み(3回) |
| `l2_sonnet`(a) | Sonnet 5.5 に (d) と同じ指示・入力・構造化出力 | 済み(3回)。実行は `uv run --with langchain-anthropic` |
| `l2_haiku`(a) | Haiku 4.5 に同じもの | 済み(3回) |
| `full_sonnet`・`gates_sonnet`(e) | 下流の文書まで含めて Sonnet で、全文書を1回 / 承認の区切りごと(題材 `detailed-full`・`simple-procedure`、正解表 `truth-e.md`) | 済み(各3回) |
| `generate.py`(f) | 同じヒアリングから、生成のモデル(flash-lite・3.8 Flash・3.6 Flash)を替えて文書を作り直す | 済み(3.8 は簡易3本で RPD の上限、3.6 は混雑で作れず) |
| (a) ほか | Opus 5.5・Gemini 3.1 Pro に同じもの | Sonnet の結果を見て要否を決める |
| (b) 段階式 | Haiku 4.5 の判定 → (a) の最良 | 原則やめる(費用・時間が問題にならないため) |

## 実行

```bash
cd devex-api   # .env を読むため
PYTHONPATH=backend uv run --project backend python ../appendix/stage8-baseline/review.py self_diagnosis --runs 3
```

既にある `runs/<方式>/<題材>/r<n>.md` は飛ばす(流し直すときは消す)。

## ファイル

| パス | 中身 |
|---|---|
| `truth.md` | 正解表(流す前に書いた。後から書き換えない) |
| `truth-e.md` | (e) の正解表(流す前に書いた) |
| `subjects/` | 題材(S・D は 51-1、detailed-full・simple-procedure は (e)) |
| `review.py` | 方式を流して出力を残す |
| `runs/` | 出力(手で書き換えない)と、時間・トークンの記録 |
| `results.md` | 判定と集計 |
