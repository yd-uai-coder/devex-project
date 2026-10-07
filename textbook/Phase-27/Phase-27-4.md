# Phase-27-4: `docs/*.md` への反映

## この章の目的

Phase 27 の決定と実装(段階8の登録・model・決定的な実装可能性チェック・SCR-008 の段階8)を、設計文書に反映する。

自動実装モード: on([introduction](./Phase-27-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 更新の内容 |
| --- | --- |
| [`docs/internal_design.md`](../../docs/internal_design.md) | `design_stages.stage` の CHECK を 1〜8 に(Alembic `c9d0e1f2a3b4`)。3.3節「5. 実装手順書」に、段階8の入力(要件定義を含む理由)・生成器が Phase 28 まで無いこと・意味モデル(鍵は単位の ID とタスク名)・決定的な検証の指摘の一覧(重さ・重要度・直す先の段階)と、手順書が無くても検証すること |
| [`docs/external_design.md`](../../docs/external_design.md) | SCR-008 の段階を1〜8に。2.8節に「Phase 27 で実装した部分」(単位の一覧・未定義の一覧・「段階Nで直す」の範囲、Phase 28 以降に残るもの) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 27 を完了に。参照の展開と、最重要が残るときの承認前の確認を Phase 28 へ |

文書のため #13・#15・#30 の対象外。

## テスト観点

スタブ不要 ── 本章は文書の更新だけで実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。文書の目視レビューと `link_check.py` で確かめる。
