# ステージ8の効果測定(Phase 58)

ステージ8(Phase 52〜57)で作った設計レビュー・差し戻し・聞き直し・「直ったか」・手順書の決定的な検証・テスト仕様書を、[ベースライン](../stage8-baseline/README.md)(Phase 51-1)と同じ題材・正解表と、実際の LLM で測ったもの。分析と判定は [Phase 58](../../textbook/Phase-58/Phase-58-introduction.md) にある。

- 日時: 2026-10-15。ローカルの devex-api(Phase 57 の版。58-5 の直しは途中から入った ── 各結果の注)。生成は `gemini-3.5-flash-lite`、レビューは `claude-sonnet-5-5`、「直ったか」は `claude-haiku-5-5`。
- 生成された文書・段階・手順書・テスト仕様書・レビューの出力は**書き換えていない**。正解表(`../stage8-baseline/truth*.md`)は付け直していない。

## 測ったもの

| 章 | 何を | 結果 |
|---|---|---|
| [58-1](../../textbook/Phase-58/Phase-58-1.md) | 本体のレビュー(指示・出力の型・モデル)を 51-1 の題材 S・D・detailed-full に各3回。指示を直して S・D・stage7 をもう3回 | [`results.md`](./results.md) |
| [58-2](../../textbook/Phase-58/Phase-58-2.md) | ペルソナで新しくヒアリング(詳細1本・簡易1本)→ 生成 → 自動レビュー → 聞き直し・差し戻し → 再レビュー → 「直ったか」、詳細は段階6・7 のレビューと段階の差し戻し | [`results-flow.md`](./results-flow.md) |
| [58-3](../../textbook/Phase-58/Phase-58-3.md) | 手順書の4つの決定的な指摘の件数(dev の DB と新しい2本)・決定的に見えない型 | [`results-procedure.md`](./results-procedure.md) |
| [58-4](../../textbook/Phase-58/Phase-58-4.md) | テスト仕様書を、先に書いた正解例と比べる・「日本語で書く」 | [`test-spec/results.md`](./test-spec/results.md) |

## 実行

```bash
cd devex-api   # .env を読むため
# 58-1(--tag=_fix は指示を直した後の出力先)
PYTHONPATH=backend:../appendix/stage8-baseline uv run --project backend \
    python ../appendix/stage8-effect/review_body.py documents --subjects simple detailed --runs 3
PYTHONPATH=backend:../appendix/stage8-baseline uv run --project backend \
    python ../appendix/stage8-effect/review_body.py stage7 --subjects detailed-full --tag=_fix
# 58-3(dev の DB はホストの 5432)
DATABASE_URL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/@postgres:/@localhost:/') \
    PYTHONPATH=backend uv run --project backend python ../appendix/stage8-effect/procedure_counts.py

cd ../appendix/stage8-effect   # 58-2(ログイン情報は state.json、git に置かない)
uv run --project ../../devex-api/backend python drive.py setup detailed-1
./say.sh detailed-1 2 "発言" [card_id:選択肢]       # 発言を input/u<n>.txt に残して送る
uv run --project ../../devex-api/backend python drive.py generate detailed-1 [--findings <id ...>]
uv run --project ../../devex-api/backend python drive.py reviews detailed-1 hearing/detailed-1/reviews/r1.json
# decide・rehearing・review <gate>・regen-stage・design・procedure・testspec は drive.py の usage
```

## ファイル

| パス | 中身 |
|---|---|
| `review_body.py` | 58-1。題材の読み込み・L0 は `../stage8-baseline/review.py`、指示・出力・LLM は本体 |
| `runs/<区切り>[_fix]/<題材>/r<n>.{md,json}` | 58-1 の出力(手で書き換えない)と、トークン・費用・時間・指摘 |
| `drive.py`・`say.sh` | 58-2。[`stage7-effect/drive.py`](../stage7-effect/README.md) の複製に、レビュー・採否・聞き直し・差し戻し・テスト仕様書を足した。「直ったか」は `SHOW_FIX=1` のときだけ表示(人が先に判定するため) |
| `input/` | 初期入力(stage7-effect と同じ) |
| `hearing/<回>/` | 送った発言・観点の表・チャット履歴・文書(`v1`・`v2`)・レビュー(`reviews/`)・段階(`stages/`)・手順書(`procedure/`)・テスト仕様書(`test_spec_v<n>.json`) |
| `spec_dump.sh` | テスト仕様書の model を DB から書き出す |
| `procedure_counts.py`・`procedure_counts_before.md`・`procedure_counts.json` | 58-3 |
| `test-spec/` | 58-4。正解例(先に書いた)・入力の版・比べた仕様書・結果 |
