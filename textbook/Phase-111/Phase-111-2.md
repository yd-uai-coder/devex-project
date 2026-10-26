# Phase-111-2: ベースライン(素朴なプロンプトの実 LLM)

## この章の目的

ステージ14 の効果を後で比べるために、取り込みの機能が無い今、素朴なプロンプトの LLM が資料から合意済みの内容と違う点をどれだけ拾えるかを記録する。結果の正本は [`appendix/measurements/stage14-baseline.md`](../../appendix/measurements/stage14-baseline.md)。

自動実装モード: on([introduction](./Phase-111-introduction.md) 参照)。この章は測定だけで、本体と samples は変えない。

## この章で作成・更新したファイル

| ファイル | 内容 |
|---|---|
| [`appendix/measurements/stage14/measure.py`](../../appendix/measurements/stage14/measure.py) | 開発環境の backend コンテナの中で動かす。`export` は合意済みの内容(要件定義書・外部設計書の最新の版)の md を書き出す(LLM なし・決定的)。`run <フォルダ>` は資料と合わせた素朴なプロンプトで、利用者の生成の用途の LLM を1回呼ぶ。DB は読むだけ |
| [`appendix/measurements/stage14/materials-a/`](../../appendix/measurements/stage14/materials-a/) | 資料セット A(議事録・メール・運用メモ) |
| [`appendix/measurements/stage14/materials-b/`](../../appendix/measurements/stage14/materials-b/) | 資料セット B(議事録・メール。撤回・CR で済んだ変更・未決・資料どうしの食い違い) |
| [`appendix/measurements/stage14/answer.md`](../../appendix/measurements/stage14/answer.md) | 正解表(違う点 G1〜G8・H1〜H5、違いでないもの N1〜N5・T1〜T4)と数え方 |
| `appendix/measurements/stage14/data/`(`agreed.md`・`baseline-{a,b}-run{1,2}.json`) | 書き出した合意済みの内容と、LLM の出力 |
| [`appendix/measurements/stage14-baseline.md`](../../appendix/measurements/stage14-baseline.md) | ベースラインの記録 |

測定の道具と記録のため、#13・#15・#30 の対象外。

## 計画モードで決めたこと

- ベースラインは、差分を仕込んだ資料 + 正解表 + 素朴なプロンプトの実 LLM(推奨どおり)。

## 進め方

1. `measure.py export` を2回流し、同じ出力になることを確かめた(`ruff check` も通った)。
2. 資料セット A を書き、正解表を LLM に流す前に固定した。
3. セット A で2回流した → 拾い漏れ0。簡単すぎたので、罠を足したセット B を書き、正解表に足してから2回流した。
4. 4回の出力を、正解表の数え方で Claude が数えた。開発環境の debug のログが標準出力の先頭に混ざったので、`---JSON---` の区切りを足した(セット A の2回は区切りの前の版で流し、ログの1行を手で除いた)。

## 結果の要点

| 指標 | A 1回目 | A 2回目 | B 1回目 | B 2回目 |
|---|---|---|---|---|
| 拾い漏れ | 0 / 8 | 0 / 8 | 0 / 5 | 0 / 5 |
| 誤り | 0 | 0 | 0 | 1(撤回) |
| 対象の誤り | 0 | 1 | 0 | 0 |
| 根拠の引用 | 8 / 8 | 8 / 8 | 5 / 5 | 5 / 5(出どころの名前の誤り1) |

- 実 LLM は4回(`gemini-3.5-flash-lite`。入力 約3千・出力 約1千トークン/回)、費用は概算 $0.01 未満。計画の見込み(約 $0.01 以下)の範囲だった。比較の Sonnet は流していない。
- **拾うことは素朴な LLM でもできる**。足りないのは、対象が自由文で CR の対象に結べないこと・引用を確かめられないこと・回ごとの揺れ。これが [111-1](./Phase-111-1.md) の決定1(測り方)と決定3(違いの形)の根拠になった。

## テスト観点

| 確かめ | SUT | ドライバ | スタブ |
|---|---|---|---|
| 合意済みの内容の書き出し | `measure.py export`(`GeneratedDocumentRepository.get_latest`) | backend コンテナで2回流して比べる | スタブ不要 ── 開発 DB を読むだけで、出力が決定的なため |
| 素朴なプロンプトの拾い方 | 実 LLM(Gemini Flash-Lite) | `measure.py run` | スタブ不要 ── 本物の LLM の振る舞いを測るため |

## 次へ

Phase 117 の効果測定で、同じ資料・同じ正解表を、ステージ14 の取り込みに通して数え直す(題材は束 B-7 を作ってから)。
