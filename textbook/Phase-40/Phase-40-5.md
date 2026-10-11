# Phase-40-5: `docs/*.md`・README への反映

## この章の目的

ステージ6の完了と、この Phase の直し([40-1](./Phase-40-1.md))を、仕様書と README に反映する。

自動実装モード: on([introduction](./Phase-40-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | 更新 | Phase 40 を完了に、マイルストーン7 の達成(Phase 39)と、ステージ6の達成範囲(Phase 40で終了。聞かれない潜在の事実が残ること、本番反映は 10.3節) |
| [`docs/internal_design.md`](../../docs/internal_design.md) | 更新 | 3.3節「6. ヒアリングと上流の構造化」に「Phase 40 で直した部分」(問いの判定・規模の制約の出どころ・本文「なし」・見出しの重なり) |
| [`docs/external_design.md`](../../docs/external_design.md) | 更新 | 2.9節の外部設計書の指摘に、本文の要らない API は「なし」と書くこと |
| [`README.md`](../../README.md) | 更新 | ステージ表のステージ6を「完了(Phase 33〜40)」に |

文書のため #13/#15/#30 の対象外。

## 設計判断

### 要件定義書は変えない

[`docs/requirements.md`](../../docs/requirements.md) はステージ6の要件(観点の表・カード・要件ID と出どころ・追跡)を Phase 33 で書いた。この Phase の直しは、その要件の中での不具合の修正で、要件は変わらない。

## テスト観点

なし(文書の目視レビュー。リンクは `link_check.py` で確かめた)。
