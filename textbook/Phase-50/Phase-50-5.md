# Phase-50-5: `docs/*.md`・README への反映

## この章の目的

ステージ7の完了と達成範囲を、実装計画書とスコープ定義に書く([Phase 40-5](../Phase-40/Phase-40-5.md) と同じ形)。Phase 42〜49 の仕様の変更は、各 Phase で [`internal_design.md`](../../docs/internal_design.md)・[`external_design.md`](../../docs/external_design.md) に反映済みなので、この章は状態の更新だけ。

自動実装モード: on([introduction](./Phase-50-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md)(4.1節 ステージ7) | 更新 | Phase 42〜50 を完了にし、各 introduction へのリンク、マイルストーン8 の達成(Phase 49)と達成範囲(Phase 50 で終了)を書く |
| [`README.md`](../../README.md)(ステージの表) | 更新 | ステージ7の状態を「完了(Phase 41〜50)」にする |

文書のため #13/#15/#30 の対象外。

## 要点

- Phase 42〜48 は、これまで実装計画書の一覧で完了にしていなかった(各 Phase の introduction と内部設計書・外部設計書には書いていた)。この章でまとめて完了にした。
- Phase 49 の行には、基準と直した後の数字(シナリオ S 過剰 22%・見落とし 2、N 過剰 23%・見落とし 0、再生成の揺れの印 0)を書いた。
- 達成範囲には、示さないもの(共有のモジュールの中で「どれを直すか」・シナリオ S2)と、本番への反映の手順(`OPERATIONS.md` 10.4節)を書いた。

## テスト観点

なし(文書の目視レビューと `link_check.py`)。
