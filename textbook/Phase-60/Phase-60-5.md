# Phase-60-5: `docs/*.md`・README への反映

## この章の目的

ステージ8の完了と達成範囲を、実装計画書とスコープ定義に書く([Phase 50-5](../Phase-50/Phase-50-5.md) と同じ形)。Phase 52〜59 の仕様の変更は、各 Phase で [`internal_design.md`](../../docs/internal_design.md)・[`external_design.md`](../../docs/external_design.md) に反映済みなので、この章は状態の更新だけ。

自動実装モード: on([introduction](./Phase-60-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md)(4.1節 ステージ8) | 更新 | Phase 52〜55・59・60 を完了にし、各 introduction へのリンク、マイルストーン9 の達成(Phase 58)と達成範囲(Phase 60 で終了)を書く |
| [`README.md`](../../README.md)(ステージの表) | 更新 | ステージ8の状態を「完了(Phase 51〜60)」にする |

文書のため #13/#15/#30 の対象外。

## 要点

- Phase 52〜55・59 は、これまで実装計画書の一覧で完了にしていなかった(Phase 56〜58 は各 Phase で完了にしていた)。この章でまとめて完了にした。Phase 54 の行には、Phase 53 の後に足した「採用した指摘の追跡」を書き足した。
- マイルストーン9 は Phase 58 の効果測定で達成した(簡易の4文書 17.7/18・詳細の要件・外部 10.0/10・詳細の全文書 22.0/27)。
- 達成範囲には、示さないもの(実装手順書とテスト仕様書のレビュー)と、本番への反映の手順(`OPERATIONS.md` 10.5節)を書いた。

## テスト観点

なし(文書の目視レビューと `link_check.py`)。
