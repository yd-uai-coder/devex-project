# Phase-100-2: ベースライン(Claude がクライアント役)

## この章の目的

ステージ13 の効果を後で比べるために、今の Devex(ステージ12 の版)が出す変更の説明書を、クライアント役が読んで、合意・却下を判断できるかを記録する。結果の正本は [`appendix/measurements/stage13-baseline.md`](../../appendix/measurements/stage13-baseline.md)。

自動実装モード: on([introduction](./Phase-100-introduction.md) 参照)。この章は測定だけで、本体と samples は変えない。

## この章で作成・更新したファイル

| ファイル | 内容 |
|---|---|
| [`appendix/measurements/stage13/measure.py`](../../appendix/measurements/stage13/measure.py) | 開発環境の backend コンテナの中で `ChangeRequestService.explanation` を呼び、CR-3・CR-4 の説明書(ダウンロードと同じ md)を JSON に書き出す。読むだけで、最後に `rollback` する |
| [`appendix/measurements/stage13/client.md`](../../appendix/measurements/stage13/client.md) | クライアント役の規則(役・読み方の規則7つ・問いの種類6つ) |
| [`appendix/measurements/stage13/data/explanations.json`](../../appendix/measurements/stage13/data/explanations.json) | 書き出した説明書 |
| [`appendix/measurements/stage13-baseline.md`](../../appendix/measurements/stage13-baseline.md) | ベースラインの記録 |

測定の道具と記録のため、#13・#15・#30 の対象外。

## 計画モードで決めたこと

- クライアント役は Claude(LLM の費用 0)。ステージ6〜8 と同じく、規則を書いてから読む。
- 題材は、トレンド追跡アプリの CR-3・CR-4。新しい生成は無い。

## 進め方

1. `measure.py` を backend コンテナで2回流し、同じ出力になることを確かめた(開発環境は `DEBUG` で SQL を標準出力に出すので、スクリプトの中で `echo` を止めた)。
2. 規則を [`client.md`](../../appendix/measurements/stage13/client.md) に書いてから、2つの説明書を読んだ。
3. CR-4 の「作業単位0件」が実際(段階1 の作り直しと印40件)と合わないので、開発 DB の束 B-4 の段階1 の写しを読み、原因を確かめた。

## 結果の要点

| 指標 | ベースライン |
|---|---|
| 判断できた CR | 1 / 2(CR-3 だけ) |
| 判断に要る問い | 2(CR-4 の範囲・費用と期間) |
| 残った疑問 | 5(範囲・前提・選択肢・結果) |
| 選択肢のある CR | 0 |

- **CR-4 は判断できない**: 画面の表示を変えるのに作業0件・テスト0件と書いてある。束 B-4 の段階1〜8 は「古い」の状態で写されていて、段階1 の処理に要件 ID が無かった。そのため予測が FR-003 → SCR-001 で止まった。説明書は、この「たどれなかった0件」と「数えた0件」を区別しない。
- **言葉**: 技術の語(X API・定期バッチ処理・Jinja2テンプレート)は、要件の文(合意の対象)の中にある。Devex の用語(推測の要件・観点)は、説明書の中で説明されない。4節の推測の要件は対象の要件そのもので、クライアント役は「自分が何を確かめるのか」が分からない。
- **要約**: CR-3 の要約は確認済みだが、CR が変わった後なので古く、出力に載っていない。開発者はそれに気づきにくい。

## 次へ

結果は [100-1](./Phase-100-1.md) の決定1(確からしさ)・決定6(説明書の直し)の根拠になった。Phase 110 の効果測定で、同じ規則・同じ表で読み直す。
