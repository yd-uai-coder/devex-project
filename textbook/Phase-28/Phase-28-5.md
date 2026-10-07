# Phase-28-5: `docs/*.md` への反映

## この章の目的

Phase 28 の決定と実装(参照の展開・手順書の生成・単位の詳細・承認前の確認・「AI に提案を求める」の撤回)を、設計文書に反映する。

自動実装モード: on([introduction](./Phase-28-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 更新の内容 |
| --- | --- |
| [`docs/internal_design.md`](../../docs/internal_design.md) | API 一覧に `GET /design-stages/units/{unit_id}/context` を足し、生成の本文に段階8の `unit_ids`。3.3節「5. 実装手順書」に、生成器を登録したこと、参照の展開(`procedure_doc_refs.py`・05・06 と同じ表を共有・バックエンドだけに置く理由)、生成の実装(対象の決め方・受け付けの断り・プロンプトの規則・`fix_stage` の正規化・merge・承認は止めない) |
| [`docs/external_design.md`](../../docs/external_design.md) | 2.8節: 単位の一覧の生成(手順書のある単位は作り直しの確認)。「AI に提案を求める」を撤回の記録(`[Phase 28 で確定 ── …]`)に。「Phase 28 で実装した部分」(生成の操作・単位の詳細と編集・承認前の確認、Phase 29・30 に残るもの) |
| [`docs/implementation_plan.md`](../../docs/implementation_plan.md) | ステージ5の Phase 28 を完了に |

文書のため #13・#15・#30 の対象外。

## テスト観点

スタブ不要 ── 本章は文書の更新だけで実装ファイルを作成しないため(SUT/ドライバ/スタブという区分自体が適用対象外)。文書の目視レビューと `link_check.py` で確かめる。
